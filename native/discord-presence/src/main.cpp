#ifdef _WIN32
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0600
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#else
#include <csignal>
#include <cstring>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#endif

#include <atomic>
#include <cerrno>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <cwchar>
#include <deque>
#include <functional>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include "presence_core.h"

namespace {

using namespace std::chrono_literals;
using sapphire::presence::Frame;
using sapphire::presence::kApplicationId;
using sapphire::presence::kHandshakeTimeout;
using sapphire::presence::kMaxFrameSize;
using sapphire::presence::kPingInterval;
using Clock = std::chrono::steady_clock;

// Connexion IPC minimale, portable entre named pipes Windows et sockets Unix.
class Connection {
 public:
#ifdef _WIN32
  explicit Connection(HANDLE handle) : handle_(handle) {}
  Connection() = default;
  ~Connection() { close(); }
  Connection(Connection&& other) noexcept : handle_(other.handle_) { other.handle_ = INVALID_HANDLE_VALUE; }
  Connection& operator=(Connection&& other) noexcept {
    if (this != &other) {
      close();
      handle_ = other.handle_;
      other.handle_ = INVALID_HANDLE_VALUE;
    }
    return *this;
  }
  Connection(const Connection&) = delete;
  Connection& operator=(const Connection&) = delete;

  bool valid() const { return handle_ != INVALID_HANDLE_VALUE && handle_ != nullptr; }

  bool readExact(void* data, std::size_t size) {
    auto* cursor = static_cast<char*>(data);
    std::size_t remaining = size;
    while (remaining > 0) {
      DWORD read = 0;
      const DWORD request = static_cast<DWORD>(remaining > 0x7fffffff ? 0x7fffffff : remaining);
      if (!ReadFile(handle_, cursor, request, &read, nullptr) || read == 0) return false;
      cursor += read;
      remaining -= read;
    }
    return true;
  }

  bool writeAll(const void* data, std::size_t size) {
    const auto* cursor = static_cast<const char*>(data);
    std::size_t remaining = size;
    while (remaining > 0) {
      DWORD written = 0;
      const DWORD request = static_cast<DWORD>(remaining > 0x7fffffff ? 0x7fffffff : remaining);
      if (!WriteFile(handle_, cursor, request, &written, nullptr) || written == 0) return false;
      cursor += written;
      remaining -= written;
    }
    return true;
  }

  void interrupt() {
    if (valid()) CancelIoEx(handle_, nullptr);
  }

  void close() {
    if (valid()) CloseHandle(handle_);
    handle_ = INVALID_HANDLE_VALUE;
  }

 private:
  HANDLE handle_ = INVALID_HANDLE_VALUE;
#else
  explicit Connection(int fd) : fd_(fd) {}
  Connection() = default;
  ~Connection() { close(); }
  Connection(Connection&& other) noexcept : fd_(other.fd_) { other.fd_ = -1; }
  Connection& operator=(Connection&& other) noexcept {
    if (this != &other) {
      close();
      fd_ = other.fd_;
      other.fd_ = -1;
    }
    return *this;
  }
  Connection(const Connection&) = delete;
  Connection& operator=(const Connection&) = delete;

  bool valid() const { return fd_ >= 0; }

  bool readExact(void* data, std::size_t size) {
    auto* cursor = static_cast<char*>(data);
    std::size_t remaining = size;
    while (remaining > 0) {
      const ssize_t read = ::read(fd_, cursor, remaining);
      if (read < 0) {
        if (errno == EINTR) continue;
        return false;
      }
      if (read == 0) return false;
      cursor += read;
      remaining -= static_cast<std::size_t>(read);
    }
    return true;
  }

  bool writeAll(const void* data, std::size_t size) {
    const auto* cursor = static_cast<const char*>(data);
    std::size_t remaining = size;
    while (remaining > 0) {
      const ssize_t written = ::write(fd_, cursor, remaining);
      if (written < 0) {
        if (errno == EINTR) continue;
        return false;
      }
      if (written == 0) return false;
      cursor += written;
      remaining -= static_cast<std::size_t>(written);
    }
    return true;
  }

  void interrupt() {
    if (valid()) ::shutdown(fd_, SHUT_RDWR);
  }

  void close() {
    if (valid()) ::close(fd_);
    fd_ = -1;
  }

 private:
  int fd_ = -1;
#endif
};

#ifdef _WIN32
// Convertit un chemin UTF-8 en UTF-16 pour CreateFileW.
std::wstring utf8ToWide(const std::string& value) {
  if (value.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) return {};
  std::wstring result(static_cast<std::size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), length);
  return result;
}

// Ouvre un named pipe Discord ou un chemin de test explicite.
std::optional<Connection> openPipe(const std::string& name) {
  const std::wstring wide = utf8ToWide(name);
  if (wide.empty()) return std::nullopt;
  HANDLE handle = CreateFileW(
      wide.c_str(),
      GENERIC_READ | GENERIC_WRITE,
      0,
      nullptr,
      OPEN_EXISTING,
      FILE_ATTRIBUTE_NORMAL,
      nullptr);
  if (handle == INVALID_HANDLE_VALUE) return std::nullopt;
  return Connection(handle);
}

// Essaie les dix pipes Discord connus, sans jamais ouvrir de fenêtre.
std::optional<Connection> connectDiscord() {
  if (const char* override = std::getenv("SAPPHIRE_DISCORD_IPC_PATH"); override && *override) {
    return openPipe(override);
  }
  for (int index = 0; index < 10; ++index) {
    if (auto connection = openPipe("\\\\.\\pipe\\discord-ipc-" + std::to_string(index))) {
      return connection;
    }
  }
  return std::nullopt;
}
#else
// Ouvre un socket Unix Discord ou un chemin de test explicite.
std::optional<Connection> connectUnix(const std::string& path) {
  sockaddr_un address{};
  if (path.size() >= sizeof(address.sun_path)) return std::nullopt;
  const int fd = ::socket(AF_UNIX, SOCK_STREAM, 0);
  if (fd < 0) return std::nullopt;
  address.sun_family = AF_UNIX;
  std::strncpy(address.sun_path, path.c_str(), sizeof(address.sun_path) - 1);
  if (::connect(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
    ::close(fd);
    return std::nullopt;
  }
  return Connection(fd);
}

// Reproduit l'ordre de résolution des sockets Discord sous Linux et macOS.
std::optional<Connection> connectDiscord() {
  if (const char* override = std::getenv("SAPPHIRE_DISCORD_IPC_PATH"); override && *override) {
    return connectUnix(override);
  }
  std::vector<std::string> bases;
  for (const char* name : {"XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"}) {
    if (const char* value = std::getenv(name); value && *value) bases.emplace_back(value);
  }
  bases.emplace_back("/tmp");
  for (const auto& path : sapphire::presence::unixSocketCandidates(bases, 10)) {
    if (auto connection = connectUnix(path)) return connection;
  }
  return std::nullopt;
}
#endif

// Lit une trame Discord exacte, avec une borne défensive.
bool readFrame(Connection& connection, Frame& frame) {
  std::uint8_t header[8]{};
  if (!connection.readExact(header, sizeof(header))) return false;
  const std::uint32_t opcode = static_cast<std::uint32_t>(header[0])
    | (static_cast<std::uint32_t>(header[1]) << 8)
    | (static_cast<std::uint32_t>(header[2]) << 16)
    | (static_cast<std::uint32_t>(header[3]) << 24);
  const std::uint32_t length = static_cast<std::uint32_t>(header[4])
    | (static_cast<std::uint32_t>(header[5]) << 8)
    | (static_cast<std::uint32_t>(header[6]) << 16)
    | (static_cast<std::uint32_t>(header[7]) << 24);
  if (length > kMaxFrameSize) return false;
  frame.opcode = opcode;
  frame.payload.assign(length, '\0');
  return length == 0 || connection.readExact(frame.payload.data(), length);
}

// Écrit une trame Discord en une seule opération, compatible avec les pipes message.
bool writeFrame(Connection& connection, std::uint32_t opcode, const std::string& payload) {
  const auto frame = sapphire::presence::encodeFrame(opcode, payload);
  return connection.writeAll(frame.data(), frame.size());
}

// Attend READY dans un thread dédié ; après READY, aucune lecture concurrente ne reste.
bool waitReady(Connection& connection) {
  std::atomic<int> result{0};
  std::thread reader([&connection, &result] {
    Frame frame;
    while (result.load() == 0) {
      if (!readFrame(connection, frame)) {
        result.store(-1);
        return;
      }
      if (frame.opcode == 1 && sapphire::presence::isReady(frame.payload)) {
        result.store(1);
        return;
      }
    }
  });
  const auto deadline = Clock::now() + kHandshakeTimeout;
  while (Clock::now() < deadline && result.load() == 0) {
    std::this_thread::sleep_for(25ms);
  }
  if (result.load() == 0) {
    connection.interrupt();
    result.store(-1);
  }
  reader.join();
  return result.load() == 1;
}

// État de présence : connexion, activité courante, clear et reconnexion.
class Presence {
 public:
  explicit Presence(int appPid) : appPid_(appPid) {}

  bool handleLine(const std::string& line) {
    if (line.empty()) return false;
    switch (line.front()) {
      case 'A':
        latest_ = line.substr(1);
        cleared_ = false;
        flush();
        break;
      case 'C':
        latest_.clear();
        cleared_ = true;
        flush();
        break;
      case 'Q':
        clear();
        return true;
      default:
        break;
    }
    return false;
  }

  void tick() {
    const auto now = Clock::now();
    if (!connected_ || !ready_ || !connection_) {
      if (connection_) {
        connection_->close();
        connection_.reset();
      }
      connected_ = false;
      ready_ = false;
      if (now >= nextRetry_) connect();
      return;
    }
    const auto payload = sapphire::presence::nextActivityPayload(latest_, cleared_);
    if (!payload.empty() && sapphire::presence::shouldSendActivity(payload, lastSent_)) {
      flush();
      return;
    }
    if (now >= nextPing_) {
      if (!writeFrame(*connection_, 3, "")) {
        disconnect();
        return;
      }
      nextPing_ = now + kPingInterval;
    }
  }

  void shutdown() {
    clear();
    if (connection_) {
      connection_->close();
      connection_.reset();
    }
    connected_ = false;
    ready_ = false;
  }

 private:
  void connect() {
    auto connection = connectDiscord();
    if (!connection) {
      scheduleRetry();
      return;
    }
    if (!writeFrame(*connection, 0, std::string(R"({"v":1,"client_id":")") + kApplicationId + R"("})")) {
      connection->close();
      scheduleRetry();
      return;
    }
    if (!waitReady(*connection)) {
      connection->close();
      scheduleRetry();
      return;
    }
    connection_ = std::make_unique<Connection>(std::move(*connection));
    connected_ = true;
    ready_ = true;
    backoff_ = 1000ms;
    nextPing_ = Clock::now() + kPingInterval;
    lastSent_.clear();
    flush();
  }

  void flush() {
    if (!connected_ || !ready_ || !connection_) return;
    const auto payload = sapphire::presence::nextActivityPayload(latest_, cleared_);
    if (payload.empty()) return;
    if (!sapphire::presence::shouldSendActivity(payload, lastSent_)) return;
    ++nonce_;
    if (!writeFrame(*connection_, 1, sapphire::presence::activityFrame(appPid_, payload, nonce_))) {
      disconnect();
      return;
    }
    lastSent_ = payload;
  }

  void clear() {
    latest_.clear();
    cleared_ = true;
    flush();
  }

  void disconnect() {
    if (connection_) {
      connection_->close();
      connection_.reset();
    }
    connected_ = false;
    ready_ = false;
    scheduleRetry();
  }

  void scheduleRetry() {
    nextRetry_ = Clock::now() + backoff_;
    backoff_ = sapphire::presence::nextBackoff(backoff_);
  }

  int appPid_ = 0;
  std::unique_ptr<Connection> connection_;
  bool connected_ = false;
  bool ready_ = false;
  std::string latest_;
  bool cleared_ = false;
  std::string lastSent_;
  std::chrono::milliseconds backoff_{1000};
  Clock::time_point nextRetry_{Clock::now()};
  Clock::time_point nextPing_{};
  int nonce_ = 0;
};

// File d'attente alimentée par le thread de lecture de stdin.
struct InputQueue {
  std::mutex mutex;
  std::condition_variable condition;
  std::deque<std::string> lines;
  bool closed = false;

  void push(std::string line) {
    {
      std::lock_guard lock(mutex);
      lines.push_back(std::move(line));
    }
    condition.notify_one();
  }

  void close() {
    {
      std::lock_guard lock(mutex);
      closed = true;
    }
    condition.notify_one();
  }
};

// Découpe un tampon en lignes complètes, en retirant un éventuel CR Windows.
void pushCompleteLines(std::string& buffer, InputQueue& queue) {
  std::size_t newline = 0;
  while ((newline = buffer.find('\n')) != std::string::npos) {
    std::string line = buffer.substr(0, newline);
    buffer.erase(0, newline + 1);
    if (!line.empty() && line.back() == '\r') line.pop_back();
    queue.push(std::move(line));
  }
}

// Lit stdin jusqu'à EOF ; le protocole reste identique au sidecar précédent.
void readInput(InputQueue& queue) {
  std::string buffer;
#ifdef _WIN32
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  if (input == nullptr || input == INVALID_HANDLE_VALUE) {
    std::string line;
    while (std::getline(std::cin, line)) {
      if (!line.empty() && line.back() == '\r') line.pop_back();
      queue.push(std::move(line));
    }
    queue.close();
    return;
  }
  char chunk[4096];
  DWORD read = 0;
  while (ReadFile(input, chunk, sizeof(chunk), &read, nullptr) && read > 0) {
    buffer.append(chunk, read);
    pushCompleteLines(buffer, queue);
  }
#else
  char chunk[4096];
  while (true) {
    const ssize_t read = ::read(STDIN_FILENO, chunk, sizeof(chunk));
    if (read < 0) {
      if (errno == EINTR) continue;
      break;
    }
    if (read == 0) break;
    buffer.append(chunk, static_cast<std::size_t>(read));
    pushCompleteLines(buffer, queue);
  }
#endif
  if (!buffer.empty()) queue.push(std::move(buffer));
  queue.close();
}

// Boucle principale : traite les lignes, tente une connexion et entretient le PING.
int run(int appPid) {
#ifndef _WIN32
  std::signal(SIGPIPE, SIG_IGN);
#endif
  InputQueue queue;
  std::thread inputThread(readInput, std::ref(queue));
  Presence presence(appPid);
  while (true) {
    std::deque<std::string> lines;
    bool closed = false;
    {
      std::unique_lock lock(queue.mutex);
      queue.condition.wait_for(lock, 1s, [&queue] { return !queue.lines.empty() || queue.closed; });
      lines.swap(queue.lines);
      closed = queue.closed;
    }
    for (const auto& line : lines) {
      if (presence.handleLine(line)) {
        presence.shutdown();
        inputThread.detach();
        return 0;
      }
    }
    if (closed && lines.empty()) {
      presence.shutdown();
      inputThread.join();
      return 0;
    }
    presence.tick();
  }
}

}  // namespace

#ifdef _WIN32
int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  int appPid = 0;
  if (argv != nullptr && argc > 1) appPid = static_cast<int>(std::wcstol(argv[1], nullptr, 10));
  if (argv != nullptr) LocalFree(argv);
  return run(appPid);
}
#else
int main(int argc, char** argv) {
  return run(argc > 1 ? std::atoi(argv[1]) : 0);
}
#endif

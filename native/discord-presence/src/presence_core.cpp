#include "presence_core.h"

#include <algorithm>
#include <sstream>

namespace sapphire::presence {

namespace {

void writeUint32(std::vector<std::uint8_t>& buffer, std::size_t offset, std::uint32_t value) {
  buffer[offset] = static_cast<std::uint8_t>(value & 0xff);
  buffer[offset + 1] = static_cast<std::uint8_t>((value >> 8) & 0xff);
  buffer[offset + 2] = static_cast<std::uint8_t>((value >> 16) & 0xff);
  buffer[offset + 3] = static_cast<std::uint8_t>((value >> 24) & 0xff);
}

std::uint32_t readUint32(const std::vector<std::uint8_t>& buffer, std::size_t offset) {
  return static_cast<std::uint32_t>(buffer[offset])
    | (static_cast<std::uint32_t>(buffer[offset + 1]) << 8)
    | (static_cast<std::uint32_t>(buffer[offset + 2]) << 16)
    | (static_cast<std::uint32_t>(buffer[offset + 3]) << 24);
}

// Joint une base et un nom de socket sans doubler le séparateur final.
std::string joinUnixPath(const std::string& base, const std::string& name) {
  if (base.empty()) return name;
  if (base.back() == '/') return base + name;
  return base + "/" + name;
}

}  // namespace

std::vector<std::uint8_t> encodeFrame(std::uint32_t opcode, const std::string& payload) {
  std::vector<std::uint8_t> frame(8 + payload.size());
  writeUint32(frame, 0, opcode);
  writeUint32(frame, 4, static_cast<std::uint32_t>(payload.size()));
  std::copy(payload.begin(), payload.end(), frame.begin() + 8);
  return frame;
}

bool decodeFrame(const std::vector<std::uint8_t>& data, std::size_t& offset, Frame& frame) {
  if (offset + 8 > data.size()) return false;
  const std::uint32_t opcode = readUint32(data, offset);
  const std::uint32_t length = readUint32(data, offset + 4);
  if (length > kMaxFrameSize) return false;
  if (offset + 8 + length > data.size()) return false;
  frame.opcode = opcode;
  frame.payload.assign(reinterpret_cast<const char*>(data.data() + offset + 8), length);
  offset += 8 + length;
  return true;
}

std::string activityFrame(int pid, const std::string& activity, int nonce) {
  std::ostringstream output;
  output << R"({"cmd":"SET_ACTIVITY","nonce":"sapphire-)" << nonce
         << R"(","args":{"pid":)" << pid
         << R"(,"activity":)" << activity << "}}";
  return output.str();
}

bool isReady(const std::string& payload) {
  return payload.find(R"("evt":"READY")") != std::string::npos
    || payload.find(R"("evt": "READY")") != std::string::npos;
}

std::chrono::milliseconds nextBackoff(std::chrono::milliseconds current) {
  const auto next = current * 2;
  return next > kMaxBackoff ? kMaxBackoff : next;
}

std::string nextActivityPayload(const std::string& latest, bool cleared) {
  if (cleared) return "null";
  return latest;
}

bool shouldSendActivity(const std::string& payload, const std::string& lastSent) {
  return payload != lastSent;
}

std::vector<std::string> unixSocketCandidates(const std::vector<std::string>& bases, int count) {
  std::vector<std::string> uniqueBases;
  for (const auto& base : bases) {
    if (base.empty()) continue;
    if (std::find(uniqueBases.begin(), uniqueBases.end(), base) == uniqueBases.end()) {
      uniqueBases.push_back(base);
    }
  }
  std::vector<std::string> paths;
  for (int index = 0; index < count; ++index) {
    const std::string name = "discord-ipc-" + std::to_string(index);
    for (const auto& base : uniqueBases) {
      paths.push_back(joinUnixPath(base, name));
    }
  }
  return paths;
}

}  // namespace sapphire::presence

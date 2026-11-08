#include <chrono>
#include <cstdint>
#include <iostream>
#include <string>
#include <vector>

#include "presence_core.h"

namespace {

using namespace std::chrono_literals;
using sapphire::presence::Frame;

int failures = 0;

// Vérifie une condition sans dépendre de NDEBUG, désactivé en Release.
void check(bool condition, const char* message) {
  if (condition) return;
  std::cerr << "FAIL: " << message << '\n';
  ++failures;
}

// Vérifie l'encodage little-endian d'une trame et son décodage.
void testFrames() {
  const auto frame = sapphire::presence::encodeFrame(1, "hello");
  check(frame.size() == 13, "frame size");
  check(frame[0] == 1 && frame[1] == 0 && frame[2] == 0 && frame[3] == 0, "opcode little-endian");
  check(frame[4] == 5 && frame[5] == 0 && frame[6] == 0 && frame[7] == 0, "length little-endian");

  std::size_t offset = 0;
  Frame decoded;
  check(sapphire::presence::decodeFrame(frame, offset, decoded), "decode frame");
  check(decoded.opcode == 1, "decoded opcode");
  check(decoded.payload == "hello", "decoded payload");
  check(offset == frame.size(), "decoded offset");

  std::vector<std::uint8_t> truncated(frame.begin(), frame.end() - 1);
  offset = 0;
  check(!sapphire::presence::decodeFrame(truncated, offset, decoded), "truncated frame refused");

  std::vector<std::uint8_t> oversized(8, 0);
  oversized[4] = 0xff;
  oversized[5] = 0xff;
  oversized[6] = 0xff;
  oversized[7] = 0x7f;
  offset = 0;
  check(!sapphire::presence::decodeFrame(oversized, offset, decoded), "oversized frame refused");
}

// Vérifie la commande SET_ACTIVITY et la reconnaissance de READY.
void testCommands() {
  const auto activity = sapphire::presence::activityFrame(123, R"({"details":"Test"})", 7);
  check(activity.find(R"("cmd":"SET_ACTIVITY")") != std::string::npos, "SET_ACTIVITY command");
  check(activity.find(R"("nonce":"sapphire-7")") != std::string::npos, "nonce");
  check(activity.find(R"("pid":123)") != std::string::npos, "pid");
  check(activity.find(R"("activity":{"details":"Test"})") != std::string::npos, "activity JSON");
  check(sapphire::presence::activityFrame(1, "null", 2).find(R"("activity":null)") != std::string::npos, "clear activity");

  check(sapphire::presence::isReady(R"({"cmd":"DISPATCH","evt":"READY","data":{}})"), "READY compact");
  check(sapphire::presence::isReady(R"({"cmd": "DISPATCH", "evt": "READY", "data": {}})"), "READY spaced");
  check(!sapphire::presence::isReady(R"({"evt":"ERROR"})"), "ERROR is not READY");
}

// Vérifie le backoff et la déduplication des activités, y compris Clear.
void testStateHelpers() {
  check(sapphire::presence::nextBackoff(1000ms) == 2000ms, "backoff 1s to 2s");
  check(sapphire::presence::nextBackoff(32000ms) == 60000ms, "backoff capped");
  check(sapphire::presence::nextBackoff(60000ms) == 60000ms, "backoff stays capped");

  check(sapphire::presence::nextActivityPayload("", false).empty(), "no activity yet");
  check(sapphire::presence::nextActivityPayload("", true) == "null", "clear payload");
  check(sapphire::presence::nextActivityPayload(R"({"a":1})", false) == R"({"a":1})", "activity payload");

  check(!sapphire::presence::shouldSendActivity("null", "null"), "duplicate clear skipped");
  check(sapphire::presence::shouldSendActivity("null", ""), "first clear sent");
  check(!sapphire::presence::shouldSendActivity(R"({"a":1})", R"({"a":1})"), "duplicate activity skipped");
  check(sapphire::presence::shouldSendActivity(R"({"a":2})", R"({"a":1})"), "changed activity sent");
}

// Vérifie que toutes les bases Unix sont essayées pour chaque index, sans le bug du seen global.
void testUnixCandidates() {
  const auto paths = sapphire::presence::unixSocketCandidates({"", "A", "B", "A"}, 2);
  check(paths.size() == 4, "unix candidate count");
  check(paths[0] == "A/discord-ipc-0", "unix first base index 0");
  check(paths[1] == "B/discord-ipc-0", "unix second base index 0");
  check(paths[2] == "A/discord-ipc-1", "unix first base index 1");
  check(paths[3] == "B/discord-ipc-1", "unix second base index 1");

  const auto slashed = sapphire::presence::unixSocketCandidates({"/tmp/"}, 1);
  check(slashed.size() == 1 && slashed[0] == "/tmp/discord-ipc-0", "unix trailing slash");
}

}  // namespace

int main() {
  testFrames();
  testCommands();
  testStateHelpers();
  testUnixCandidates();
  if (failures != 0) {
    std::cerr << failures << " test(s) failed.\n";
    return 1;
  }
  std::cout << "presence_core tests passed.\n";
  return 0;
}

#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace sapphire::presence {

// Application Discord commune à tous les utilisateurs de Sapphire 3.
inline constexpr char kApplicationId[] = "1568755585250492416";
inline constexpr auto kMaxBackoff = std::chrono::milliseconds(60000);
inline constexpr auto kHandshakeTimeout = std::chrono::milliseconds(3000);
inline constexpr auto kPingInterval = std::chrono::milliseconds(15000);
inline constexpr std::size_t kMaxFrameSize = 4 * 1024 * 1024;

struct Frame {
  std::uint32_t opcode = 0;
  std::string payload;
};

// Encode une trame Discord complète en little-endian.
std::vector<std::uint8_t> encodeFrame(std::uint32_t opcode, const std::string& payload);

// Décode une trame depuis un tampon et avance l'offset ; refuse les trames trop grandes.
bool decodeFrame(const std::vector<std::uint8_t>& data, std::size_t& offset, Frame& frame);

// Construit SET_ACTIVITY sans parser le JSON de l'activité.
std::string activityFrame(int pid, const std::string& activity, int nonce);

// Reconnaît READY malgré les variantes d'espacement de Discord.
bool isReady(const std::string& payload);

// Backoff exponentiel borné.
std::chrono::milliseconds nextBackoff(std::chrono::milliseconds current);

// Charge utile réellement envoyée : null pour un effacement, sinon l'activité brute.
std::string nextActivityPayload(const std::string& latest, bool cleared);

// Évite les SET_ACTIVITY redondants, y compris les répétitions de Clear.
bool shouldSendActivity(const std::string& payload, const std::string& lastSent);

// Construit les chemins Unix dans l'ordre prévu, sans sauter de base après l'index 0.
std::vector<std::string> unixSocketCandidates(const std::vector<std::string>& bases, int count = 10);

}  // namespace sapphire::presence

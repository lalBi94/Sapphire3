cmake_minimum_required(VERSION 3.25)

project(sapphire3_discord_presence LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(discord-presence WIN32
  src/main.cpp
  src/presence_core.cpp
)
target_include_directories(discord-presence PRIVATE src)

if(WIN32 AND NOT MSVC)
  # Zig/MinGW ignore -mwindows pour le sous-système ; cette option force l'absence de console.
  target_link_options(discord-presence PRIVATE -Wl,--subsystem,windows)
endif()

if(UNIX AND NOT APPLE)
  target_link_libraries(discord-presence PRIVATE pthread)
endif()

option(PRESENCE_BUILD_TESTS "Build the C++ presence tests" ON)
if(PRESENCE_BUILD_TESTS)
  enable_testing()
  add_executable(presence_tests
    tests/presence_tests.cpp
    src/presence_core.cpp
  )
  target_include_directories(presence_tests PRIVATE src)
  add_test(NAME presence_tests COMMAND presence_tests)
endif()

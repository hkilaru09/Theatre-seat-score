cmake_minimum_required(VERSION 3.24)
project(seatscore_cpp VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(SEATSCORE_TESTS "Build the tests" ON)
option(SEATSCORE_BENCH "Build the benchmarks" ON)

include(FetchContent)
FetchContent_Declare(nlohmann_json
  URL https://github.com/nlohmann/json/releases/download/v3.12.0/json.tar.xz
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(nlohmann_json)

set(SEATSCORE_WARNINGS -Wall -Wextra -Wpedantic -Wconversion -Wshadow -Werror)

add_library(seatscore
  src/bookings.cpp
  src/geometry.cpp
  src/groups.cpp
  src/json_io.cpp
  src/scoring.cpp)
target_include_directories(seatscore PUBLIC include)
target_link_libraries(seatscore PUBLIC nlohmann_json::nlohmann_json)
target_compile_options(seatscore PRIVATE ${SEATSCORE_WARNINGS})
set_target_properties(seatscore PROPERTIES POSITION_INDEPENDENT_CODE ON)

add_executable(seatscore_cli tools/seatscore_cli.cpp)
target_link_libraries(seatscore_cli PRIVATE seatscore)
target_compile_options(seatscore_cli PRIVATE ${SEATSCORE_WARNINGS})

if(SEATSCORE_TESTS)
  enable_testing()
  FetchContent_Declare(googletest
    URL https://github.com/google/googletest/releases/download/v1.17.0/googletest-1.17.0.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP ON)
  set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)

  add_executable(seatscore_tests
    tests/test_bookings.cpp
    tests/test_geometry.cpp
    tests/test_groups.cpp
    tests/test_parity.cpp
    tests/test_scoring.cpp)
  target_link_libraries(seatscore_tests PRIVATE seatscore GTest::gtest_main)
  target_compile_options(seatscore_tests PRIVATE ${SEATSCORE_WARNINGS})
  target_compile_definitions(seatscore_tests PRIVATE
    SEATSCORE_DATA_DIR="${CMAKE_CURRENT_SOURCE_DIR}/../web/src/data"
    SEATSCORE_GOLDEN_DIR="${CMAKE_CURRENT_SOURCE_DIR}/tests/golden")
  include(GoogleTest)
  gtest_discover_tests(seatscore_tests)
endif()

if(SEATSCORE_BENCH)
  FetchContent_Declare(benchmark
    URL https://github.com/google/benchmark/archive/refs/tags/v1.9.4.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP ON)
  set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
  set(BENCHMARK_ENABLE_GTEST_TESTS OFF CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(benchmark)

  add_executable(seatscore_bench bench/bench_engine.cpp)
  target_link_libraries(seatscore_bench PRIVATE seatscore benchmark::benchmark)
  target_compile_options(seatscore_bench PRIVATE ${SEATSCORE_WARNINGS})
endif()


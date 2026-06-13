'use strict';

// ─── PAO SETUP (user adds this once per agent file) ──────────────────────────
const { agent } = require('../agent-client');
// ─────────────────────────────────────────────────────────────────────────────

// ─── AGENT SETUP (user's own agent code) ─────────────────────────────────────
const { Agent } = require('@mastra/core/agent');
const { createTool } = require('@mastra/core/tools');
const { google } = require('@ai-sdk/google');
const { z } = require('zod');
// ─────────────────────────────────────────────────────────────────────────────

// async function run(input) {
//   const startedAt = Date.now();
//   const city = String(input ?? '').trim() || 'London';
//   let spanCounter = 0;
//   let currentWeather = null;
//   let forecast = null;

//   // ─── PAO: start run (user adds this) ───────────────────────────────────────
//   const agentRun = await agent.startRun('weather-task', {
//     metadata: { agent: 'weather', city: city.slice(0, 80) },
//   });
//   console.log('[PAO] Run started:', agentRun.id);
//   // ───────────────────────────────────────────────────────────────────────────

//   // ─── AGENT: define tools with closures so each execution creates its own PAO span
//   const geocodeTool = createTool({
//     id: 'geocode',
//     description: 'Geocode a city name to get its latitude and longitude coordinates',
//     inputSchema: z.object({
//       city: z.string().describe('The city name to geocode'),
//     }),
//     execute: async ({ city: cityName }) => {
//       // ─── PAO: span per tool execution ──────────────────────────────────────
//       const span = agentRun.startSpan('tool_call', {
//         name: 'geocode-city',
//         toolName: 'geocode',
//         inputPreview: cityName,
//       });
//       // ───────────────────────────────────────────────────────────────────────

//       // ─── AGENT: real tool logic ────────────────────────────────────────────
//       const res = await fetch(
//         `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`
//       );
//       const data = await res.json();
//       const location = data.results?.[0];

//       if (!location) {
//         span.end({ status: 'error', errorMessage: `City not found: ${cityName}` });
//         spanCounter++;
//         throw new Error(`City not found: ${cityName}`);
//       }
//       // ───────────────────────────────────────────────────────────────────────

//       // ─── PAO: end span with real output ────────────────────────────────────
//       span.end({
//         outputPreview: `lat=${location.latitude} lon=${location.longitude}`,
//         status: 'success',
//       });
//       console.log('[PAO] geocode span ended, buffer should have 1 span');
//       spanCounter++;
//       // ───────────────────────────────────────────────────────────────────────

//       return {
//         latitude: location.latitude,
//         longitude: location.longitude,
//         name: location.name,
//         country: location.country,
//         timezone: location.timezone ?? 'auto',
//       };
//     },
//   });

//   const weatherTool = createTool({
//     id: 'get-weather',
//     description: 'Fetch current weather and 3-day forecast for given coordinates',
//     inputSchema: z.object({
//       latitude: z.number().describe('Latitude of the location'),
//       longitude: z.number().describe('Longitude of the location'),
//       timezone: z.string().optional().describe('Timezone string (e.g. "Europe/London")'),
//     }),
//     execute: async ({ latitude, longitude, timezone }) => {
//       // ─── PAO: span per tool execution ──────────────────────────────────────
//       const span = agentRun.startSpan('tool_call', {
//         name: 'fetch-weather',
//         toolName: 'get-weather',
//         inputPreview: `lat=${latitude} lon=${longitude}`,
//       });
//       // ───────────────────────────────────────────────────────────────────────

//       // ─── AGENT: real tool logic ────────────────────────────────────────────
//       const tz = timezone ?? 'auto';
//       const url =
//         `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
//         `&current=temperature_2m,wind_speed_10m,precipitation,weathercode` +
//         `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
//         `&forecast_days=3&timezone=${encodeURIComponent(tz)}`;

//       const res = await fetch(url);
//       const data = await res.json();

//       const curr = data.current;
//       currentWeather = {
//         temperature: curr.temperature_2m,
//         windSpeed: curr.wind_speed_10m,
//         precipitation: curr.precipitation,
//         weatherCode: curr.weathercode,
//         time: curr.time,
//       };

//       const daily = data.daily;
//       forecast = daily.time.map((date, i) => ({
//         date,
//         maxTemp: daily.temperature_2m_max[i],
//         minTemp: daily.temperature_2m_min[i],
//         precipitation: daily.precipitation_sum[i],
//       }));
//       // ───────────────────────────────────────────────────────────────────────

//       // ─── PAO: end span with real output ────────────────────────────────────
//       span.end({
//         outputPreview: `temp=${currentWeather.temperature}°C wind=${currentWeather.windSpeed}km/h`,
//         status: 'success',
//       });
//       console.log('[PAO] weather span ended, buffer should have 2 spans');
//       spanCounter++;
//       // ───────────────────────────────────────────────────────────────────────

//       return { currentWeather, forecast };
//     },
//   });

//   // ─── AGENT: create agent per-request (tools close over agentRun) ──────────
//   const weatherAgent = new Agent({
//     name: 'weather',
//     instructions: `You are a weather reporter. Given a city name:
// 1. Use the geocode tool to find the city's latitude and longitude.
// 2. Use the get-weather tool with those coordinates to fetch real weather data.
// 3. Write a detailed, engaging, human-readable weather report using the real data you received.
// Include the current temperature, wind speed, precipitation, and the 3-day forecast in your report.`,
//     model: google('gemini-2.5-flash'),
//     tools: { geocode: geocodeTool, 'get-weather': weatherTool },
//   });
//   // ─────────────────────────────────────────────────────────────────────────

//   // ─── PAO: llm_call span wrapping the full agent generation ────────────────
//   const llmSpan = agentRun.startSpan('llm_call', {
//     name: 'weather-report-generation',
//     agentName: 'weather',
//     model: 'gemini-2.5-flash',
//     inputPreview: city,
//   });
//   // ──────────────────────────────────────────────────────────────────────────

//   let report, inputTokens, outputTokens;
//   try {
//     // ─── AGENT: run the agent (user's own code) ───────────────────────────
//     const result = await weatherAgent.generate(
//       `Get the weather for ${city} and write a weather report.`
//     );
//     report = result.text;
//     inputTokens = result.usage?.promptTokens ?? 0;
//     outputTokens = result.usage?.completionTokens ?? 0;
//     // ─────────────────────────────────────────────────────────────────────

//     // ─── PAO: complete llm span ───────────────────────────────────────────
//     llmSpan.end({
//       status: 'success',
//       outputPreview: report.slice(0, 200),
//       inputTokens,
//       outputTokens,
//       costUsd: 0,
//     });
//     console.log('[PAO] llm span ended, buffer should have 3 spans');
//     spanCounter++;
//     // ─────────────────────────────────────────────────────────────────────
//   } catch (err) {
//     llmSpan.end({ status: 'error', errorMessage: err.message });
//     await agentRun.complete({ status: 'failed' });
//     throw err;
//   }

//   // ─── PAO: complete run (user adds this) ────────────────────────────────────
//   await agentRun.complete({ status: 'completed' });
//   console.log('[PAO] run completed');
//   // ───────────────────────────────────────────────────────────────────────────

//   return {
//     output: {
//       city,
//       report,
//       currentWeather: currentWeather ?? {},
//       forecast: forecast ?? [],
//     },
//     spanCount: spanCounter,
//     durationMs: Date.now() - startedAt,
//     runId: agentRun.id ?? '',
//   };
// }

// ─── REFACTORED VERSION: using createTrackedTool() ───────────────────────────
// Same weather agent as above but using the new PAO SDK feature.
// createTrackedTool() automatically manages span lifecycle — no manual
// startSpan() or span.end() needed inside tool execute functions.
//
// PAO instrumentation in this version: ~8 lines (vs ~35 in run() above)
// ─────────────────────────────────────────────────────────────────────────────

async function runV2(input) {
  const startedAt = Date.now();
  const city = String(input ?? '').trim() || 'London';
  let currentWeather = null;
  let forecast = null;

  // ─── PAO: start run (same as v1) ───────────────────────────────────────────
  const agentRun = await agent.startRun('weather-task', {
    metadata: { agent: 'weather', city: city.slice(0, 80) },
  });
  console.log('[PAO] Run started:', agentRun.id);
  // ───────────────────────────────────────────────────────────────────────────

  // ─── PAO: createTrackedTool() wraps execute — span lifecycle is automatic ──
  const geocodeTool = agentRun.createTrackedTool({
    id: 'geocode',
    spanName: 'geocode-city',
    description: 'Geocode a city name to get its latitude and longitude coordinates',
    inputSchema: z.object({
      city: z.string().describe('The city name to geocode'),
    }),
    getInputPreview:  ({ city: cityName }) => cityName,
    getOutputPreview: (result) => `lat=${result.latitude} lon=${result.longitude}`,
    // ─── AGENT: pure fetch logic — zero PAO lines inside execute ─────────────
    execute: async ({ city: cityName }) => {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`
      );
      const data = await res.json();
      const location = data.results?.[0];

      if (!location) throw new Error(`City not found: ${cityName}`);

      return {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        country: location.country,
        timezone: location.timezone ?? 'auto',
      };
    },
    // ─────────────────────────────────────────────────────────────────────────
  });
  // ───────────────────────────────────────────────────────────────────────────

  // ─── PAO: createTrackedTool() for weather fetch ────────────────────────────
  const weatherTool = agentRun.createTrackedTool({
    id: 'get-weather',
    spanName: 'fetch-weather',
    description: 'Fetch current weather and 3-day forecast for given coordinates',
    inputSchema: z.object({
      latitude:  z.number().describe('Latitude of the location'),
      longitude: z.number().describe('Longitude of the location'),
      timezone:  z.string().optional().describe('Timezone string (e.g. "Europe/London")'),
    }),
    getInputPreview:  ({ latitude, longitude }) => `lat=${latitude} lon=${longitude}`,
    getOutputPreview: () => `temp=${currentWeather?.temperature}°C wind=${currentWeather?.windSpeed}km/h`,
    // ─── AGENT: pure fetch logic — zero PAO lines inside execute ─────────────
    execute: async ({ latitude, longitude, timezone }) => {
      const tz = timezone ?? 'auto';
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,wind_speed_10m,precipitation,weathercode` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&forecast_days=3&timezone=${encodeURIComponent(tz)}`;

      const res = await fetch(url);
      const data = await res.json();

      const curr = data.current;
      currentWeather = {
        temperature:   curr.temperature_2m,
        windSpeed:     curr.wind_speed_10m,
        precipitation: curr.precipitation,
        weatherCode:   curr.weathercode,
        time:          curr.time,
      };

      const daily = data.daily;
      forecast = daily.time.map((date, i) => ({
        date,
        maxTemp:       daily.temperature_2m_max[i],
        minTemp:       daily.temperature_2m_min[i],
        precipitation: daily.precipitation_sum[i],
      }));

      return { currentWeather, forecast };
    },
    // ─────────────────────────────────────────────────────────────────────────
  });
  // ───────────────────────────────────────────────────────────────────────────

  // ─── AGENT: create agent per-request (same as v1) ─────────────────────────
  const weatherAgent = new Agent({
    name: 'weather',
    instructions: `You are a weather reporter. Given a city name:
1. Use the geocode tool to find the city's latitude and longitude.
2. Use the get-weather tool with those coordinates to fetch real weather data.
3. Write a detailed, engaging, human-readable weather report using the real data you received.
Include the current temperature, wind speed, precipitation, and the 3-day forecast in your report.`,
    model: google('gemini-2.5-flash'),
    tools: { geocode: geocodeTool, 'get-weather': weatherTool },
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ─── PAO: llm span ───────────────────────────────────────────────────────────
  // ─── AGENT: run the agent ────────────────────────────────────────────────────
  const result = await agentRun.withLLMSpan({
    name: 'weather-report-generation',
    agentName: 'weather',
    model: 'gemini-2.5-flash',
    inputPreview: city,
    execute: () => weatherAgent.generate(`Get the weather for ${city} and write a weather report.`),
    getOutputPreview: (r) => r.text.slice(0, 200),
    getTokens: (r) => ({
      input:  r.usage?.promptTokens ?? 0,
      output: r.usage?.completionTokens ?? 0,
    }),
  });
  // ─────────────────────────────────────────────────────────────────────────────

  // ─── PAO: complete run (same as v1) ──────────────────────────────────────
  await agentRun.complete({ status: 'completed' });
  console.log('[PAO] run completed');
  // ─────────────────────────────────────────────────────────────────────────

  return {
    output: {
      city,
      report: result.text,
      currentWeather: currentWeather ?? {},
      forecast:       forecast ?? [],
    },
    durationMs: Date.now() - startedAt,
    runId: agentRun.id ?? '',
  };
}

module.exports = { run: runV2, runV2 };
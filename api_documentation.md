# My Data API Documentation
# hosted at https://aaronep.pythonanywhere.com/api/v1/

This document describes the newly created JSON API routes that a new frontend application can use to query and render the data provided by the backend, all while keeping the data cleanly separated.

### Base Path
All data endpoints are nested under `/api/v1/`.

### Processing Note: Just-In-Time (JIT) Sync
Most API endpoints now automatically trigger a **Just-In-Time (JIT)** processing of the webhook queue and/or specific activity details. This ensures that the data returned is always up-to-date with any recent activity on Strava, even if the background worker hasn't processed it yet.

---

## 1. Segment Report
**Endpoint:** `GET /api/v1/segment-report`

**Description:** Returns the complete segment report generated from the database, grouped into buckets by distance and grade.

**Response format:**
```json
{
  "Short (0-3km) / Steep (8%+)": {
    "Segment Name": [
      {
        "average_cadence": 85.0,
        "average_hr": 160.0,
        "average_watts": 250.5,
        "date": "10/24/2023",
        "elapsed_time": 120,
        "gear": "Cannondale FS",
        "is_estimated": false,
        "rank": 1
      }
    ]
  }
}
```

---

## 2. Speed Trends
**Endpoint:** `GET /api/v1/speed-trends`

**Description:** Returns speed trends grouped by segment distance and average grade buckets. Includes calculated speed trend lines, summaries, and predicted speeds.

**Response format:**
```json
{
  "Short (0-3km) / Low (1-4%)": {
    "segments": ["Segment 1", "Segment 2"],
    "gears": {
      "Bike Name": {
        "description": "Increasing (+0.24 mph/month)",
        "prediction": "Predicted speed in 3 months: 18.50 mph.",
        "efforts": [
          {
            "date": "2023-10-24",
            "elapsed_time": 450,
            "segment_name": "Segment 1",
            "speed": 17.5,
            "timestamp": 1698105600.0
          }
        ],
        "trendline": [17.0, 17.2, 17.5]
      }
    },
    "summary": {
      "fastest_gear": "Bike Name",
      "performance": [
        {
          "average_speed": 17.4,
          "gear": "Bike Name"
        }
      ]
    }
  }
}
```

---

## 3. Power Trends
**Endpoint:** `GET /api/v1/power-trends`

**Description:** Returns power trends aggregated by month, showing the average watts from the top 3 efforts within each segment bucket.

**Response format:**
```json
{
  "Medium (3-8km) / Medium (4-8%)": {
    "segments": ["Another Segment"],
    "data": [
      {
        "avg_power": 245.5,
        "month": "2023-10",
        "num_efforts": 5
      }
    ]
  }
}
```

---

## 4. Chain Usage Tracking
**Endpoint:** `GET /api/v1/chain-usage`

**Description:** Returns metadata related to the configured gear, including miles travelled since chain replacements, and trainer mappings.

**Response format:**
```json
{
  "all_bikes": [...],
  "main_bikes": [
    {
      "chain_target_id": null,
      "id": "b123456",
      "last_chain_replacement": "2026-02-01",
      "last_chain_wax": "2026-02-01",
      "miles_last_year": 1250.5,
      "miles_since_replacement": 250.0,
      "miles_since_wax": 100.5,
      "name": "Road Bike"
    }
  ],
  "trainer_bikes": [...]
}
```

---

## 5. Bicycle Usage (Mileage)
**Endpoint:** `GET /api/v1/bicycle-usage`

**Description:** Returns riding distances per bike partitioned by year and month.

**Response format:**
```json
{
  "Road Bike": {
    "all_time_total_activities": 120,
    "all_time_total_distance": 3400.5,
    "years": {
      "2023": {
        "months": {
          "2023-10": {
            "activities": 10,
            "distance": 250.0
          }
        },
        "total_activities": 45,
        "total_distance": 1200.0
      }
    }
  }
}
```

---

## 6. Activities
**Endpoint:** `GET /api/v1/activities`

**Description:** Returns paginated list of synchronized Strava activities along with matched gear information.

**Query Parameters:**
- `page` (default `1`)
- `per_page` (default `25`)

**Response format:**
```json
{
  "page": 1,
  "per_page": 25,
  "total_activities": 250,
  "total_pages": 10,
  "activities": [
    {
      "average_heartrate": 145.0,
      "average_watts": 185.2,
      "average_speed_mph": 17.5,
      "date_iso": "2023-10-24",
      "detected_gear_name": "Cannondale F29",
      "distance": 45000.0,
      "distance_miles": 27.96,
      "formatted_date": "2023-10-24 15:30",
      "gear_name": "Road Bike",
      "id": 1234567890,
      "moving_time": 5400,
      "moving_time_str": "1:30:00",
      "name": "Afternoon Ride",
      "start_date_local": "2023-10-24T15:30:00Z"
    }
  ]
}
```

**Note:** `detected_gear_name` is the bike identified by FIT file analysis (if available), while `gear_name` is the bike manually assigned in Strava.

---

## 7. Activity Details
**Endpoint:** `GET /api/v1/activity/<activity_id>`

**Description:** Returns detailed information about a specific activity, including segment effort performance and rankings against all efforts, efforts this year, same gear, and same gear this year. Also includes peak power metrics (best 5s, 30s, 5m, 20m, 1h) and normalized power.

**Response format:**
```json
{
    "activity": {
    "average_cadence": 85.0,
    "average_heartrate": 145.0,
    "average_speed_mph": 17.5,
    "average_watts": 185.2,
    "best_1h": 220.5,
    "best_20min": 265.2,
    "best_30s": 650.0,
    "best_5min": 324.5,
    "best_5s": 850.2,
    "distance": 45000.0,
    "distance_miles": 27.96,
    "formatted_date": "2023-10-24 15:30",
    "gear_id": "b123456",
    "gear_name": "Road Bike",
    "id": 1234567890,
    "moving_time": 5400,
    "moving_time_str": "1:30:00",
    "name": "Afternoon Ride",
    "norm_power": 250.8,
    "start_date_local": "2023-10-24T15:30:00Z"
  },
  "efforts": [
    {
      "average_cadence": 85.0,
      "average_heartrate": 160.0,
      "average_speed": 18.5,
      "average_watts": 250.5,
      "distance": 1200.0,
      "distance_miles": 0.75,
      "elapsed_time": 240,
      "id": 987654321,
      "rankings": {
        "all_time": { "rank": 5, "total": 120 },
        "same_gear": { "rank": 2, "total": 45 },
        "same_gear_this_year": { "rank": 1, "total": 10 },
        "this_year": { "rank": 3, "total": 30 }
      },
      "segment_id": 12345,
      "segment_name": "Park Sprint",
      "start_date_local": "2023-10-24T15:45:00Z",
      "time_str": "4:00"
    }
  ]
}
```

---
## 8. Detect Gear (Trigger)
**Endpoint:** `GET /api/v1/detect-gear-for-activity/<activity_id>`

**Description:** Manually triggers the Dropbox FIT file analysis for a specific activity. This connects to Dropbox, identifies the matching FIT file, extracts sensor data to map the bike, and calculates advanced performance metrics (Power bests, NP).

**Response format (success):**
```json
{
  "success": true
}
```

**Response format (error):**
```json
{
  "success": false,
  "error": "Error message details"
}
```

**Note:** This is a synchronous (blocking) call that can take several seconds to complete as it involves network I/O with Dropbox and FIT parsing.

---

## 9. Sync Strava (Trigger)
**Endpoint:** `POST /api/v1/sync-strava`

**Description:** Triggers the backend Strava data synchronization (`sync_strava_data`). This endpoint allows the frontend to request an on-demand sync. The request accepts an optional JSON body to control the sync behavior.

**Request body (JSON, optional):**
- `after_date` (string): A date in `YYYY-MM-DD` format to limit activity fetches to activities after this date. Passed to `sync_strava_data` as `after_date_override`.
- `is_webhook` (boolean): When `true`, runs the sync in webhook mode (lighter/fast response, avoids heavy lookbacks).

**Response format (success):**
```json
{
  "success": true,
  "summary": "Last Sync: 2026-04-14 12:34:56 | Activities: +3 | Gear: +1 | Segments: +2, -0"
}
```

**Response format (error):**
```json
{
  "success": false,
  "error": "An unexpected error occurred: <details>"
}
```

**Notes:** This endpoint may take several seconds to complete depending on the amount of data to sync. Use `is_webhook=true` for faster responses when triggered by webhook workflows.

---

## 10. Strava Webhooks (Internal)
**Endpoint:** `GET / POST /webhook`

**Description:** Endpoint used by Strava to push real-time updates (create/update/delete activity).

- **GET:** used for the initial handshake and verification.
- **POST:** receives JSON event data. Incoming events are queued in the `webhook_events` table for JIT processing.

**Response:** `EVENT_RECEIVED` (200 OK)

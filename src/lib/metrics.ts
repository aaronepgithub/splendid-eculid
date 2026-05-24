import { Activity, AthleteProfile, WeeklyLoad } from '../types';

/**
 * Estimate Functional Threshold Power (FTP) for a list of activities.
 * Typically 95% of peak 20-min power, or fallback to 95% of average power.
 */
export function estimateActivityFtp(activity: Activity): number | null {
  if (activity.best_20min && activity.best_20min > 0) {
    return activity.best_20min * 0.95;
  }
  if (activity.average_watts && activity.average_watts > 100) {
    // If no 20min peak power but average watts is high (like a race),
    // estimate FTP slightly lower than average if it was long, or lower if short.
    const durationMin = activity.moving_time / 60;
    if (durationMin >= 45) {
      return activity.average_watts * 0.95;
    } else if (durationMin >= 20) {
      return activity.average_watts * 0.90;
    }
  }
  return null;
}

/**
 * Calculates the athlete's FTP history month-by-month.
 * Returns an array of months and the peak estimated FTP in each month.
 */
export function calculateFtpHistory(activities: Activity[]): { month: string; ftp: number }[] {
  const ftpByMonth: Record<string, number[]> = {};

  // Sort activities chronologically
  const sorted = [...activities].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));

  sorted.forEach(activity => {
    const ftp = estimateActivityFtp(activity);
    if (ftp) {
      const month = activity.start_date_local.substring(0, 7); // YYYY-MM
      if (!ftpByMonth[month]) ftpByMonth[month] = [];
      ftpByMonth[month].push(ftp);
    }
  });

  return Object.entries(ftpByMonth)
    .map(([month, ftps]) => ({
      month,
      ftp: Math.round(Math.max(...ftps)) // Use peak FTP achieved in that month
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Calculates estimated TSS (Training Stress Score) for an activity.
 * TSS = (sec * NP * IF) / (FTP * 3600) * 100, where IF = NP / FTP
 */
export function estimateActivityTss(activity: Activity, currentFtp: number): { tss: number; intensityFactor: number } {
  const ftp = currentFtp > 0 ? currentFtp : 200; // default FTP fallback
  const durationSec = activity.moving_time;
  
  let np = activity.norm_power || activity.average_watts || 0;
  
  // If no power data, estimate average watts from speed or heartrate
  if (np === 0) {
    if (activity.average_heartrate && activity.average_heartrate > 0) {
      // Estimate power from heart rate relative to threshold
      // E.g., threshold heart rate ~ 160 bpm, threshold power ~ FTP
      const hrRatio = activity.average_heartrate / 160;
      np = ftp * Math.min(1.2, Math.max(0.4, hrRatio - 0.1));
    } else {
      // Estimate from speed
      const speed = activity.average_speed_mph || (activity.distance_miles / (durationSec / 3600)) || 12;
      // Crude approximation: 15 mph = 150W, quadratic relation
      np = Math.min(400, Math.max(50, 150 * Math.pow(speed / 15, 2)));
    }
  }

  const intensityFactor = np / ftp;
  const tss = (durationSec * np * intensityFactor) / (ftp * 3600) * 100;
  
  return {
    tss: Math.round(tss),
    intensityFactor: parseFloat(intensityFactor.toFixed(2))
  };
}

/**
 * Calculates weekly training volume and estimated TSS.
 */
export function calculateWeeklyLoad(activities: Activity[], ftpHistory: { month: string; ftp: number }[]): WeeklyLoad[] {
  const weeklyData: Record<string, { distance: number; duration: number; count: number; tss: number }> = {};

  // Get current FTP mapping by month for quick lookup
  const ftpMap = new Map(ftpHistory.map(f => [f.month, f.ftp]));
  const getFtpForDate = (dateStr: string) => {
    const month = dateStr.substring(0, 7);
    return ftpMap.get(month) || 200;
  };

  activities.forEach(activity => {
    const date = new Date(activity.start_date_local);
    // Find the Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    const weekStart = monday.toISOString().substring(0, 10);

    const ftp = getFtpForDate(activity.start_date_local);
    const { tss } = estimateActivityTss(activity, ftp);

    if (!weeklyData[weekStart]) {
      weeklyData[weekStart] = { distance: 0, duration: 0, count: 0, tss: 0 };
    }

    weeklyData[weekStart].distance += activity.distance_miles;
    weeklyData[weekStart].duration += activity.moving_time / 60; // in minutes
    weeklyData[weekStart].count += 1;
    weeklyData[weekStart].tss += tss;
  });

  return Object.entries(weeklyData)
    .map(([weekStart, stats]) => ({
      weekStart,
      distance: Math.round(stats.distance * 10) / 10,
      duration: Math.round(stats.duration),
      activitiesCount: stats.count,
      estimatedTss: Math.round(stats.tss)
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Simulates Training Load over time (CTL, ATL, TSB) to estimate fitness levels.
 * CTL = Chronic Training Load (42-day rolling average of daily TSS) - representing Fitness.
 * ATL = Acute Training Load (7-day rolling average of daily TSS) - representing Fatigue.
 * TSB = Training Stress Balance (CTL - ATL) - representing Form.
 */
export function calculateFitnessTrends(activities: Activity[], ftpHistory: { month: string; ftp: number }[]) {
  if (activities.length === 0) {
    return [];
  }

  // Sort activities chronologically
  const sorted = [...activities].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local));

  // Determine date range
  const firstDate = new Date(sorted[0].start_date_local.substring(0, 10));
  const today = new Date();
  
  // Calculate difference in days
  const diffTime = Math.abs(today.getTime() - firstDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Map daily TSS
  const dailyTss: Record<string, number> = {};
  const ftpMap = new Map(ftpHistory.map(f => [f.month, f.ftp]));
  const getFtpForDate = (dateStr: string) => {
    const month = dateStr.substring(0, 7);
    return ftpMap.get(month) || 220; // default to 220
  };

  sorted.forEach(activity => {
    const dateStr = activity.start_date_local.substring(0, 10);
    const ftp = getFtpForDate(activity.start_date_local);
    const { tss } = estimateActivityTss(activity, ftp);
    dailyTss[dateStr] = (dailyTss[dateStr] || 0) + tss;
  });

  const trends: { date: string; ctl: number; atl: number; tsb: number }[] = [];
  let ctl = 0;
  let atl = 0;

  // Simulate day by day
  const currentDate = new Date(firstDate);
  for (let i = 0; i < diffDays; i++) {
    const dateStr = currentDate.toISOString().substring(0, 10);
    const tss = dailyTss[dateStr] || 0;

    // Coggan formulation for CTL/ATL:
    // CTL_today = CTL_yesterday + (TSS - CTL_yesterday) / 42
    // ATL_today = ATL_yesterday + (TSS - ATL_yesterday) / 7
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    const tsb = ctl - atl;

    trends.push({
      date: dateStr,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return trends;
}

/**
 * Classifies the athlete's phenotype (profile strength) and overall fitness profile.
 */
export function generateAthleteProfile(
  activities: Activity[],
  ftpHistory: { month: string; ftp: number }[],
  weightKg = 72 // default weight in kg
): AthleteProfile {
  // 1. Get recent FTP
  const recentFtp = ftpHistory.length > 0 ? ftpHistory[ftpHistory.length - 1].ftp : 220;
  const maxFtp = ftpHistory.length > 0 ? Math.max(...ftpHistory.map(f => f.ftp)) : 220;

  // 2. Compute absolute peak powers in recent 3 months
  const recentActs = activities.slice(0, 50); // Take last 50 activities
  let peak5s = 0;
  let peak30s = 0;
  let peak5m = 0;
  let peak20m = 0;

  recentActs.forEach(act => {
    if (act.best_5s && act.best_5s > peak5s) peak5s = act.best_5s;
    if (act.best_30s && act.best_30s > peak30s) peak30s = act.best_30s;
    if (act.best_5min && act.best_5min > peak5m) peak5m = act.best_5min;
    if (act.best_20min && act.best_20min > peak20m) peak20m = act.best_20min;
  });

  // Fallbacks if no advanced power bests
  if (peak20m === 0) peak20m = recentFtp / 0.95;
  if (peak5m === 0) peak5m = peak20m * 1.15;
  if (peak30s === 0) peak30s = peak5m * 1.6;
  if (peak5s === 0) peak5s = peak30s * 1.8;

  // Power to weight ratio (W/kg)
  const ftpWkg = recentFtp / weightKg;
  const peak5mWkg = peak5m / weightKg;
  const peak5sWkg = peak5s / weightKg;

  // 3. Classify Phenotype
  let phenotype = 'All-Rounder';
  if (peak5sWkg > 15.0 && peak5s / recentFtp > 4.5) {
    phenotype = 'Sprinter';
  } else if (peak5mWkg > 5.5 && peak5m / recentFtp > 1.30) {
    phenotype = 'VO2 Max Specialist (Climber)';
  } else if (ftpWkg > 4.0 && peak5s / recentFtp < 3.2) {
    phenotype = 'Steady-State Engine (Time-Trialist)';
  } else if (recentActs.length > 0 && recentActs.filter(a => a.distance_miles > 50).length > 5) {
    phenotype = 'Diesel Engine (Endurance / Audax)';
  }

  // 4. Calculate current fitness level category
  let fitnessLevel = 'Active';
  if (ftpWkg > 4.5) {
    fitnessLevel = 'Elite';
  } else if (ftpWkg > 3.8) {
    fitnessLevel = 'Athletic';
  } else if (ftpWkg > 3.0) {
    fitnessLevel = 'Competent';
  } else if (ftpWkg < 2.2) {
    fitnessLevel = 'Novice';
  }

  // 5. Calculate Aerobic Efficiency (EF) average (Watts / Heartrate)
  const efValues = activities
    .filter(a => a.average_watts && a.average_watts > 100 && a.average_heartrate && a.average_heartrate > 80)
    .map(a => a.average_watts! / a.average_heartrate);

  const avgEf = efValues.length > 0 
    ? efValues.reduce((sum, v) => sum + v, 0) / efValues.length 
    : 1.25; // Default reference

  // 6. Calculate Recent Training Form (CTL / ATL / TSB)
  const trends = calculateFitnessTrends(activities, ftpHistory);
  const latestTrend = trends.length > 0 ? trends[trends.length - 1] : { ctl: 10, atl: 10, tsb: 0 };
  
  let formStatus = 'Maintaining';
  if (latestTrend.tsb < -25) {
    formStatus = 'Overreaching';
  } else if (latestTrend.tsb < -10) {
    formStatus = 'Productive (Training)';
  } else if (latestTrend.tsb > 15) {
    // If TSB is high, check if CTL is decreasing
    const pastTrend = trends[Math.max(0, trends.length - 14)] || latestTrend;
    if (latestTrend.ctl < pastTrend.ctl - 3) {
      formStatus = 'Detraining (Declining)';
    } else {
      formStatus = 'Fresh (Peak Recovery)';
    }
  } else {
    formStatus = 'Optimal (Form Balance)';
  }

  return {
    estimatedFtp: Math.round(recentFtp),
    maxFtp: Math.round(maxFtp),
    weightKg,
    currentFitnessLevel: fitnessLevel,
    athletePhenotype: phenotype,
    aerobicEfficiencyAvg: parseFloat(avgEf.toFixed(2)),
    recentForm: {
      fitness: Math.round(latestTrend.ctl),
      fatigue: Math.round(latestTrend.atl),
      form: Math.round(latestTrend.tsb),
      status: formStatus
    }
  };
}

/**
 * Calculates aerobic efficiency values month-by-month to plot progression.
 */
export function calculateAerobicEfficiencyHistory(activities: Activity[]): { month: string; ef: number }[] {
  const efByMonth: Record<string, number[]> = {};

  activities.forEach(activity => {
    if (activity.average_watts && activity.average_watts > 100 && activity.average_heartrate && activity.average_heartrate > 80) {
      const month = activity.start_date_local.substring(0, 7); // YYYY-MM
      const ef = activity.average_watts / activity.average_heartrate;
      if (!efByMonth[month]) efByMonth[month] = [];
      efByMonth[month].push(ef);
    }
  });

  return Object.entries(efByMonth)
    .map(([month, values]) => ({
      month,
      ef: parseFloat((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

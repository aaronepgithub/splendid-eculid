import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Activity as ActivityIcon, 
  Sparkles, 
  History, 
  Zap, 
  Heart, 
  Clock, 
  Trophy, 
  AlertTriangle, 
  Menu, 
  X, 
  ChevronRight,
  Info,
  Dumbbell,
  Scale
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { fitnessApi } from './services/fitnessService';
import { 
  Activity, 
  ActivitiesResponse, 
  ActivityDetails,
  AthleteProfile,
  WeeklyLoad
} from './types';
import { formatDisplayDate, formatTimeStr } from './lib/utils';
import { 
  estimateActivityFtp,
  calculateFtpHistory,
  calculateWeeklyLoad,
  generateAthleteProfile,
  calculateFitnessTrends,
  calculateAerobicEfficiencyHistory
} from './lib/metrics';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'power' | 'aerobic' | 'activities' | 'coach'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesResponse, setActivitiesResponse] = useState<ActivitiesResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  
  // Athlete Stats State
  const [ftpHistory, setFtpHistory] = useState<{ month: string; ftp: number }[]>([]);
  const [weeklyLoad, setWeeklyLoad] = useState<WeeklyLoad[]>([]);
  const [fitnessTrends, setFitnessTrends] = useState<{ date: string; ctl: number; atl: number; tsb: number }[]>([]);
  const [efHistory, setEfHistory] = useState<{ month: string; ef: number }[]>([]);
  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile | null>(null);
  const [athleteWeight, setAthleteWeight] = useState<number>(72); // Default weight in kg
  
  // Selected Activity Details
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [activityDetails, setActivityDetails] = useState<ActivityDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detectingGear, setDetectingGear] = useState(false);

  // Load all activities for core calculations
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch a large chunk of activities (e.g. 150) to compute fitness levels and trends
        const response = await fitnessApi.getActivities(1, 150);
        const acts = response.activities || [];
        setActivities(acts);
        
        // Setup initial response for list pagination
        setActivitiesResponse(response);
        
        // Calculate core metrics
        const ftpHist = calculateFtpHistory(acts);
        setFtpHistory(ftpHist);
        
        const efHist = calculateAerobicEfficiencyHistory(acts);
        setEfHistory(efHist);

        const profile = generateAthleteProfile(acts, ftpHist, athleteWeight);
        setAthleteProfile(profile);

        const weekLoad = calculateWeeklyLoad(acts, ftpHist);
        setWeeklyLoad(weekLoad.slice(-12)); // Take past 12 weeks

        const fitTrends = calculateFitnessTrends(acts, ftpHist);
        setFitnessTrends(fitTrends.slice(-90)); // Take past 90 days
        
      } catch (error) {
        console.error("Error loading activities data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [athleteWeight]);

  // Handle page pagination for activities list
  const handlePageChange = async (page: number) => {
    setLoading(true);
    try {
      const response = await fitnessApi.getActivities(page, 20);
      setActivitiesResponse(response);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error changing page:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Activity details when an activity is selected
  useEffect(() => {
    if (!selectedActivityId) return;

    const fetchDetails = async () => {
      setDetailsLoading(true);
      try {
        const details = await fitnessApi.getActivityDetails(selectedActivityId);
        setActivityDetails(details);
      } catch (error) {
        console.error("Error fetching activity details:", error);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedActivityId]);

  // Trigger gear/advanced metrics detection
  const handleDetectGear = async (activityId: number) => {
    setDetectingGear(true);
    try {
      const result = await fitnessApi.detectGearForActivity(activityId);
      if (result.success) {
        // Refresh details
        const details = await fitnessApi.getActivityDetails(activityId);
        setActivityDetails(details);
        // Refresh all activities
        const response = await fitnessApi.getActivities(1, 150);
        setActivities(response.activities || []);
      } else {
        alert(result.message || "Failed to trigger gear detection. Please ensure the FIT file is available in your synced storage.");
      }
    } catch (error) {
      console.error("Error trigger gear detection:", error);
    } finally {
      setDetectingGear(false);
    }
  };

  // Trigger Strava synchronization
  const handleSyncStrava = async () => {
    setSyncResult(null);
    setSyncing(true);
    try {
      const res = await fitnessApi.syncStrava({ is_webhook: false });
      if (res?.success) {
        setSyncResult(res.summary || 'Synchronization successful');
        // Reload all data
        const response = await fitnessApi.getActivities(1, 150);
        const acts = response.activities || [];
        setActivities(acts);
        const ftpHist = calculateFtpHistory(acts);
        setFtpHistory(ftpHist);
        const efHist = calculateAerobicEfficiencyHistory(acts);
        setEfHistory(efHist);
        setAthleteProfile(generateAthleteProfile(acts, ftpHist, athleteWeight));
        setWeeklyLoad(calculateWeeklyLoad(acts, ftpHist).slice(-12));
        setFitnessTrends(calculateFitnessTrends(acts, ftpHist).slice(-90));
      } else {
        setSyncResult(res?.error || 'Synchronization completed with no summary');
      }
    } catch (err: any) {
      setSyncResult(err?.message || String(err));
    } finally {
      setSyncing(false);
    }
  };

  // Nav configuration
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'power', name: 'Power Profile', icon: Zap },
    { id: 'aerobic', name: 'Aerobic Efficiency', icon: Heart },
    { id: 'activities', name: 'Activities History', icon: History },
    { id: 'coach', name: 'AI Coach', icon: Sparkles }
  ] as const;

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <ActivityIcon size={20} />
          </div>
          <span className="sidebar-logo-text" style={{ textFillColor: 'initial', webkitTextFillColor: 'initial', color: 'white' }}>VeloPulse</span>
        </div>
        <button className="btn-icon" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="sidebar-mobile" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="sidebar-mobile-content" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-logo" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="sidebar-logo-icon">
                  <ActivityIcon size={20} />
                </div>
                <span className="sidebar-logo-text" style={{ color: 'white' }}>VeloPulse</span>
              </div>
              <button className="btn-icon" style={{ border: 'none' }} onClick={() => setIsMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="nav-item-icon" />
                  {item.name}
                </button>
              ))}
            </nav>

            <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
              <div className="profile-summary">
                <div className="profile-avatar">AE</div>
                <div className="profile-info">
                  <p className="profile-name">Aaron E-P</p>
                  <p className="profile-title">{athleteProfile?.currentFitnessLevel} Athlete</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <ActivityIcon size={20} />
          </div>
          <span className="sidebar-logo-text" style={{ color: 'white' }}>VeloPulse</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
              onClick={() => setCurrentTab(item.id)}
            >
              <item.icon className="nav-item-icon" />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-summary">
            <div className="profile-avatar">AE</div>
            <div className="profile-info">
              <p className="profile-name">Aaron E-P</p>
              <p className="profile-title">{athleteProfile?.currentFitnessLevel || 'Active'} Athlete</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Page Top Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h2>
              {currentTab === 'dashboard' && 'Athletic Fitness Dashboard'}
              {currentTab === 'power' && 'Power Profile Analysis'}
              {currentTab === 'aerobic' && 'Aerobic Efficiency History'}
              {currentTab === 'activities' && 'Activity Logs & Details'}
              {currentTab === 'coach' && 'AI Athletic Coach'}
            </h2>
            <p>
              {currentTab === 'dashboard' && 'Monitor your chronic training load, current estimated threshold and progression.'}
              {currentTab === 'power' && 'Examine sprint, anaerobic capacity, and threshold power progression over time.'}
              {currentTab === 'aerobic' && 'Assess your cardiovascular improvements based on power-to-heart rate decoupling ratios.'}
              {currentTab === 'activities' && 'Drill down into individual workouts, normalized power metrics, and segment rankings.'}
              {currentTab === 'coach' && 'Get customized feedback, training plans, and load analyses based on your physical files.'}
            </p>
          </div>
          
          <div className="header-actions">
            <button 
              className="btn btn-primary" 
              onClick={handleSyncStrava}
              disabled={syncing}
            >
              <Zap size={16} />
              {syncing ? 'Synchronizing...' : 'Sync Strava'}
            </button>
          </div>
        </div>

        {syncResult && (
          <div className="card" style={{ marginBottom: '2rem', padding: '1rem', borderLeft: '4px solid var(--brand-orange)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{syncResult}</span>
            <button onClick={() => setSyncResult(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {loading && activities.length === 0 ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-orange)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Analyzing fitness files and building profile...</p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView 
                athleteProfile={athleteProfile} 
                ftpHistory={ftpHistory} 
                weeklyLoad={weeklyLoad} 
                fitnessTrends={fitnessTrends}
                activities={activities}
                setSelectedActivityId={setSelectedActivityId}
                athleteWeight={athleteWeight}
                setAthleteWeight={setAthleteWeight}
              />
            )}
            
            {currentTab === 'power' && (
              <PowerProfileView 
                activities={activities}
                athleteProfile={athleteProfile}
                athleteWeight={athleteWeight}
              />
            )}

            {currentTab === 'aerobic' && (
              <AerobicView 
                activities={activities}
                efHistory={efHistory}
              />
            )}

            {currentTab === 'activities' && (
              <ActivitiesListView 
                activitiesResponse={activitiesResponse}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onSelectActivity={setSelectedActivityId}
              />
            )}

            {currentTab === 'coach' && (
              <AICoachView 
                athleteProfile={athleteProfile}
                ftpHistory={ftpHistory}
                weeklyLoad={weeklyLoad}
              />
            )}
          </>
        )}
      </main>

      {/* Activity Details Modal */}
      {selectedActivityId && (
        <ActivityDetailsModal 
          activityId={selectedActivityId}
          activityDetails={activityDetails}
          loading={detailsLoading}
          onClose={() => {
            setSelectedActivityId(null);
            setActivityDetails(null);
          }}
          detectingGear={detectingGear}
          onDetectGear={handleDetectGear}
          ftp={athleteProfile?.estimatedFtp || 220}
        />
      )}
    </div>
  );
}

// ==========================================
// DASHBOARD VIEW
// ==========================================
interface DashboardProps {
  athleteProfile: AthleteProfile | null;
  ftpHistory: { month: string; ftp: number }[];
  weeklyLoad: WeeklyLoad[];
  fitnessTrends: { date: string; ctl: number; atl: number; tsb: number }[];
  activities: Activity[];
  setSelectedActivityId: (id: number) => void;
  athleteWeight: number;
  setAthleteWeight: (w: number) => void;
}

function DashboardView({ 
  athleteProfile, 
  ftpHistory, 
  weeklyLoad, 
  fitnessTrends,
  activities,
  setSelectedActivityId,
  athleteWeight,
  setAthleteWeight
}: DashboardProps) {
  
  const currentFtp = athleteProfile?.estimatedFtp || 220;
  const wattsPerKg = (currentFtp / athleteWeight).toFixed(2);
  
  // Format FTP History for Recharts
  const formattedFtpChart = ftpHistory.map(item => ({
    ...item,
    month: item.month.split('-').reverse().join('/')
  }));

  // Format Fitness Trends for Recharts (CTL/ATL/TSB)
  const formattedTrends = fitnessTrends.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 4 Stats Cards */}
      <div className="stats-grid">
        <div className="card metric-card">
          <div className="metric-header">
            <span className="metric-label">Estimated FTP</span>
            <div className="metric-icon-bg bg-orange-alpha">
              <Zap size={20} />
            </div>
          </div>
          <div className="metric-value-container">
            <span className="metric-value">{currentFtp}</span>
            <span className="metric-unit">W</span>
          </div>
          <div className="metric-trend trend-up">
            <TrendingUp size={14} />
            <span>Power weight ratio: {wattsPerKg} W/kg</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span className="metric-label">Fitness Score (CTL)</span>
            <div className="metric-icon-bg bg-blue-alpha">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="metric-value-container">
            <span className="metric-value">{athleteProfile?.recentForm.fitness || 0}</span>
            <span className="metric-unit">pts</span>
          </div>
          <div className="metric-trend trend-neutral">
            <span>Fatigue (ATL): {athleteProfile?.recentForm.fatigue || 0} pts</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span className="metric-label">Training Form (TSB)</span>
            <div className="metric-icon-bg bg-purple-alpha">
              <Dumbbell size={20} />
            </div>
          </div>
          <div className="metric-value-container">
            <span className="metric-value">{athleteProfile?.recentForm.form || 0}</span>
            <span className="metric-unit">pts</span>
          </div>
          <div className="metric-trend" style={{ color: athleteProfile?.recentForm.form && athleteProfile.recentForm.form < -10 ? 'var(--warning)' : 'var(--success)' }}>
            <span>Status: {athleteProfile?.recentForm.status || 'Optimal'}</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">
            <span className="metric-label">Profile Phenotype</span>
            <div className="metric-icon-bg bg-gold-alpha">
              <Trophy size={20} />
            </div>
          </div>
          <div className="metric-value-container">
            <span className="metric-value" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              {athleteProfile?.athletePhenotype.split(' (')[0] || 'All-Rounder'}
            </span>
          </div>
          <div className="metric-trend trend-neutral">
            <span>Aerobic efficiency: {athleteProfile?.aerobicEfficiencyAvg} W/bpm</span>
          </div>
        </div>
      </div>

      {/* Double Column Layout */}
      <div className="dashboard-layout">
        
        {/* Left Column: Fitness Trends & FTP History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Fitness Form Chart (CTL / ATL / TSB) */}
          <div className="card">
            <div className="card-title-container">
              <h3>
                <TrendingUp size={18} style={{ color: 'var(--brand-blue)' }} />
                90-Day Training Stress Balance (CTL / ATL / TSB)
              </h3>
              <span className="badge badge-outline">Periodized Load</span>
            </div>
            <p className="card-subtitle">
              Chronic Training Load (Fitness/Blue) represents consolidated base. Acute Training Load (Fatigue/Orange) represents short-term stress. Form (TSB/Yellow Fill) represents recovery level.
            </p>
            
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCtl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-blue)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--brand-blue)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAtl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-orange)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--brand-orange)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTsb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-gold)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--brand-gold)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'white' }}
                    labelStyle={{ fontWeight: 'bold', color: 'var(--brand-orange)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="ctl" name="Fitness (CTL)" stroke="var(--brand-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorCtl)" />
                  <Area type="monotone" dataKey="atl" name="Fatigue (ATL)" stroke="var(--brand-orange)" strokeWidth={2} fillOpacity={1} fill="url(#colorAtl)" />
                  <Area type="monotone" dataKey="tsb" name="Form (TSB)" stroke="var(--brand-gold)" strokeWidth={1} fillOpacity={1} fill="url(#colorTsb)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FTP Progression Timeline */}
          <div className="card">
            <div className="card-title-container">
              <h3>
                <Zap size={18} style={{ color: 'var(--brand-orange)' }} />
                Threshold Power (FTP) Progression
              </h3>
              <span className="badge badge-brand">FTP Trend</span>
            </div>
            <p className="card-subtitle">
              Calculated month-by-month as 95% of peak 20-minute power efforts. A rising line shows direct threshold fitness progress.
            </p>
            
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedFtpChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 15', 'dataMax + 15']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit="W" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'white' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="ftp" name="Estimated FTP" stroke="var(--brand-orange)" strokeWidth={3} dot={{ r: 5, fill: 'var(--brand-orange)', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Weekly Training Load & Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Athlete Configuration Card */}
          <div className="card">
            <h3>
              <Scale size={18} style={{ color: 'var(--text-secondary)' }} />
              Athlete Weight Config
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <label className="form-label">Athlete Weight (kg)</label>
              <input 
                type="number" 
                className="form-input" 
                value={athleteWeight}
                onChange={(e) => setAthleteWeight(Math.max(40, Math.min(150, parseInt(e.target.value) || 70)))}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Adjusting weight updates your power-to-weight ratio (W/kg) calculations instantly across the app.
              </p>
            </div>
          </div>

          {/* Weekly Stress Volume (TSS) */}
          <div className="card">
            <div className="card-title-container">
              <h3>
                <Dumbbell size={18} style={{ color: 'var(--brand-purple)' }} />
                Weekly Training Stress
              </h3>
            </div>
            <p className="card-subtitle">
              Weekly sum of training stress score (TSS). Consistent volume and progressive overload drives adaptation.
            </p>

            <div className="chart-container" style={{ height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyLoad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="weekStart" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(val) => val.slice(5)} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'white' }}
                  />
                  <Bar dataKey="estimatedTss" name="Weekly TSS" fill="var(--brand-purple)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Top Performances */}
          <div className="card">
            <h3>
              <Trophy size={18} style={{ color: 'var(--brand-gold)' }} />
              Recent Key Workouts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {activities.slice(0, 5).map(act => {
                const ftp = estimateActivityFtp(act);
                return (
                  <div 
                    key={act.id} 
                    style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setSelectedActivityId(act.id)}
                  >
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{act.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(act.start_date_local).toLocaleDateString()} • {act.distance_miles.toFixed(1)} mi
                      </p>
                    </div>
                    {ftp && (
                      <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>
                        {Math.round(ftp)}W FTP
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// POWER PROFILE VIEW
// ==========================================
interface PowerProfileProps {
  activities: Activity[];
  athleteProfile: AthleteProfile | null;
  athleteWeight: number;
}

function PowerProfileView({ activities, athleteProfile, athleteWeight }: PowerProfileProps) {
  // Compute chronological progression of peak durations
  // Group by month and find peak values
  const [powerHist, setPowerHist] = useState<{ month: string; peak5s: number; peak30s: number; peak5m: number; peak20m: number }[]>([]);

  useEffect(() => {
    const powerByMonth: Record<string, { p5s: number[]; p30s: number[]; p5m: number[]; p20m: number[] }> = {};
    
    activities.forEach(act => {
      const month = act.start_date_local.substring(0, 7); // YYYY-MM
      if (!powerByMonth[month]) {
        powerByMonth[month] = { p5s: [], p30s: [], p5m: [], p20m: [] };
      }
      if (act.best_5s) powerByMonth[month].p5s.push(act.best_5s);
      if (act.best_30s) powerByMonth[month].p30s.push(act.best_30s);
      if (act.best_5min) powerByMonth[month].p5m.push(act.best_5min);
      
      if (act.best_20min) {
        powerByMonth[month].p20m.push(act.best_20min);
      } else if (act.average_watts && act.average_watts > 100) {
        // Fallback: estimate 20min peak from average watts
        powerByMonth[month].p20m.push(act.average_watts * 1.05);
      }
    });

    const parsedHistory = Object.entries(powerByMonth)
      .map(([month, powers]) => {
        let peak5 = powers.p5s.length > 0 ? Math.max(...powers.p5s) : 0;
        let peak30 = powers.p30s.length > 0 ? Math.max(...powers.p30s) : 0;
        let peak5min = powers.p5m.length > 0 ? Math.max(...powers.p5m) : 0;
        let peak20min = powers.p20m.length > 0 ? Math.max(...powers.p20m) : 0;

        // Cascade estimates if we only have 20m peak
        if (peak20min > 0) {
          if (peak5min === 0) peak5min = peak20min * 1.15;
          if (peak30 === 0) peak30 = peak5min * 1.6;
          if (peak5 === 0) peak5 = peak30 * 1.8;
        }

        return {
          month: month.split('-').reverse().join('/'),
          peak5s: peak5 > 0 ? peak5 : null,
          peak30s: peak30 > 0 ? peak30 : null,
          peak5m: peak5min > 0 ? peak5min : null,
          peak20m: peak20min > 0 ? peak20min : null
        };
      })
      // filter out months with insufficient data
      .filter(item => item.peak5s !== null || item.peak5m !== null || item.peak20m !== null)
      .sort((a, b) => a.month.localeCompare(b.month));

    setPowerHist(parsedHistory);
  }, [activities]);

  // Compute power curves to show current capacity (best across all activities)
  const max5s = powerHist.length > 0 ? Math.max(...powerHist.map(h => h.peak5s || 0)) : 0;
  const max30s = powerHist.length > 0 ? Math.max(...powerHist.map(h => h.peak30s || 0)) : 0;
  const max5m = powerHist.length > 0 ? Math.max(...powerHist.map(h => h.peak5m || 0)) : 0;
  const max20m = powerHist.length > 0 ? Math.max(...powerHist.map(h => h.peak20m || 0)) : 0;

  // Power to weight ratio comparisons (standard Coggan categories)
  const wkg5s = max5s / athleteWeight;
  const wkg30s = max30s / athleteWeight;
  const wkg5m = max5m / athleteWeight;
  const wkg20m = max20m / athleteWeight;

  const standardClass = (val: number, type: '5s' | '30s' | '5m' | '20m') => {
    // Basic category thresholds: Untrained, Fair, Good, Excellent, Pro
    if (type === '5s') {
      if (val > 18) return 'World Class / Pro';
      if (val > 14) return 'Excellent (Cat 1/2)';
      if (val > 11) return 'Good (Cat 3/4)';
      return 'Fair / Recreational';
    }
    if (type === '30s') {
      if (val > 12) return 'World Class / Pro';
      if (val > 9) return 'Excellent (Cat 1/2)';
      if (val > 7) return 'Good (Cat 3/4)';
      return 'Fair / Recreational';
    }
    if (type === '5m') {
      if (val > 6.0) return 'World Class / Pro';
      if (val > 4.8) return 'Excellent (Cat 1/2)';
      if (val > 3.8) return 'Good (Cat 3/4)';
      return 'Fair / Recreational';
    }
    // 20m power (threshold)
    if (val > 5.0) return 'World Class / Pro';
    if (val > 4.0) return 'Excellent (Cat 1/2)';
    if (val > 3.1) return 'Good (Cat 3/4)';
    return 'Fair / Recreational';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Power Phenotype Classification details */}
      <div className="ai-coach-banner" style={{ borderLeftColor: 'var(--brand-gold)', background: 'linear-gradient(135deg, var(--bg-secondary), rgba(234, 179, 8, 0.05))' }}>
        <div className="ai-coach-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--brand-gold)' }}>
          <Trophy size={28} />
        </div>
        <div className="ai-coach-title">
          <h3>Athlete Phenotype Profile: {athleteProfile?.athletePhenotype}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Based on your peak power ratios, your primary strength is classified as <strong>{athleteProfile?.athletePhenotype.split(' (')[0]}</strong>. You excel in workouts matching this metabolic profile.
          </p>
        </div>
      </div>

      {/* Peak Power Durations Chart */}
      <div className="card">
        <div className="card-title-container">
          <h3>
            <Zap size={18} style={{ color: 'var(--brand-orange)' }} />
            Monthly Peak Power Durations Progression
          </h3>
          <span className="badge badge-outline">Anaerobic & Threshold</span>
        </div>
        <p className="card-subtitle">
          Peak wattage captured in each month for Sprint (5s), Anaerobic (30s), VO2 Max (5m), and Threshold (20m). Compare how these capacities develop over the training blocks.
        </p>

        <div className="chart-container" style={{ height: '360px' }}>
          {powerHist.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerHist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit="W" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'white' }} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                <Line type="monotone" dataKey="peak5s" name="Sprint (5s)" stroke="var(--brand-orange)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={true} />
                <Line type="monotone" dataKey="peak30s" name="Anaerobic (30s)" stroke="var(--brand-purple)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={true} />
                <Line type="monotone" dataKey="peak5m" name="VO2 Max (5m)" stroke="var(--brand-blue)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={true} />
                <Line type="monotone" dataKey="peak20m" name="Threshold (20m)" stroke="var(--brand-gold)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No power data available. Please ensure your activities contain power meter data.
            </div>
          )}
        </div>
      </div>

      {/* Coggan Category Ratios Panel */}
      <div className="card">
        <h3>
          <Scale size={18} style={{ color: 'var(--text-secondary)' }} />
          Peak Power Weight Ratios & Categories
        </h3>
        <p className="card-subtitle" style={{ marginBottom: '1.5rem' }}>
          Your power outputs adjusted for your current body weight ({athleteWeight} kg). These ratios are standard measures of competitive category levels.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          
          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <span className="detail-tile-label">Sprint Power (5s)</span>
            <p className="detail-tile-value" style={{ margin: '0.25rem 0' }}>{max5s > 0 ? `${Math.round(max5s)} W` : 'N/A'}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-orange)' }}>{wkg5s > 0 ? `${wkg5s.toFixed(2)} W/kg` : 'N/A'}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
              Category: {wkg5s > 0 ? standardClass(wkg5s, '5s') : 'N/A'}
            </p>
          </div>

          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <span className="detail-tile-label">Anaerobic Power (30s)</span>
            <p className="detail-tile-value" style={{ margin: '0.25rem 0' }}>{max30s > 0 ? `${Math.round(max30s)} W` : 'N/A'}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-purple)' }}>{wkg30s > 0 ? `${wkg30s.toFixed(2)} W/kg` : 'N/A'}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
              Category: {wkg30s > 0 ? standardClass(wkg30s, '30s') : 'N/A'}
            </p>
          </div>

          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <span className="detail-tile-label">VO2 Max Power (5m)</span>
            <p className="detail-tile-value" style={{ margin: '0.25rem 0' }}>{max5m > 0 ? `${Math.round(max5m)} W` : 'N/A'}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-blue)' }}>{wkg5m > 0 ? `${wkg5m.toFixed(2)} W/kg` : 'N/A'}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
              Category: {wkg5m > 0 ? standardClass(wkg5m, '5m') : 'N/A'}
            </p>
          </div>

          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <span className="detail-tile-label">Threshold Power (FTP)</span>
            <p className="detail-tile-value" style={{ margin: '0.25rem 0' }}>{athleteProfile?.estimatedFtp ? `${athleteProfile.estimatedFtp} W` : 'N/A'}</p>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-gold)' }}>{wkg20m > 0 ? `${wkg20m.toFixed(2)} W/kg` : 'N/A'}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
              Category: {wkg20m > 0 ? standardClass(wkg20m, '20m') : 'N/A'}
            </p>
          </div>

        </div>
      </div>
      
    </div>
  );
}

// ==========================================
// AEROBIC EFFICIENCY VIEW
// ==========================================
interface AerobicProps {
  activities: Activity[];
  efHistory: { month: string; ef: number }[];
}

function AerobicView({ activities, efHistory }: AerobicProps) {
  // Format history
  const formattedEf = efHistory.map(item => ({
    ...item,
    month: item.month.split('-').reverse().join('/')
  }));

  // Filter activities with heart rate and power to plot scatter points
  const scatterPoints = activities
    .filter(a => a.average_watts && a.average_watts > 100 && a.average_heartrate && a.average_heartrate > 80)
    .slice(0, 100) // Show last 100
    .map(a => ({
      name: a.name,
      power: Math.round(a.average_watts!),
      hr: Math.round(a.average_heartrate),
      ef: parseFloat((a.average_watts! / a.average_heartrate).toFixed(2)),
      date: new Date(a.start_date_local).toLocaleDateString()
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Description Info Banner */}
      <div className="card" style={{ padding: '1.25rem 1.75rem', background: 'rgba(59, 130, 246, 0.05)', borderLeft: '5px solid var(--brand-blue)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Info size={20} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            <strong>Aerobic Efficiency Index (EF)</strong> measures cardiovascular fitness. It is calculated as <code>Average Power / Average Heart Rate</code>. An increasing ratio indicates you are producing more power at the same or lower heart rate, showing cardiovascular gains.
          </p>
        </div>
      </div>

      {/* Aerobic Efficiency Trend Timeline */}
      <div className="card">
        <div className="card-title-container">
          <h3>
            <Heart size={18} style={{ color: 'var(--brand-blue)' }} />
            Monthly Aerobic Efficiency Progression
          </h3>
          <span className="badge badge-success">Cardiovascular Gains</span>
        </div>
        <p className="card-subtitle">
          Timeline showing your average monthly Aerobic Efficiency (EF) index. Consistent endurance training increases capillary density and stroke volume, causing this index to climb.
        </p>

        <div className="chart-container" style={{ height: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedEf} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['dataMin - 0.2', 'dataMax + 0.2']} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'white' }} />
              <Line type="monotone" dataKey="ef" name="Aerobic Efficiency (W/bpm)" stroke="var(--brand-blue)" strokeWidth={3} dot={{ r: 5, fill: 'var(--brand-blue)', strokeWidth: 2, stroke: 'white' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Efficiency Scatter list */}
      <div className="card">
        <h3>
          <ActivityIcon size={18} style={{ color: 'var(--text-secondary)' }} />
          Recent Ride Efficiency Data (Last 100 Rides)
        </h3>
        <p className="card-subtitle" style={{ marginBottom: '1.5rem' }}>
          Details of individual rides where heart rate and power sensor files are present. Sort through the activities that showed your best cardiovascular performance.
        </p>

        <div className="table-wrapper">
          <table className="activities-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity Name</th>
                <th>Avg Power</th>
                <th>Avg Heart Rate</th>
                <th>Efficiency Index (EF)</th>
              </tr>
            </thead>
            <tbody>
              {scatterPoints.slice(0, 10).map((pt, idx) => (
                <tr key={idx}>
                  <td>{pt.date}</td>
                  <td style={{ fontWeight: 'bold', color: 'white' }}>{pt.name}</td>
                  <td>{pt.power} W</td>
                  <td>{pt.hr} bpm</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--brand-blue)' }}>{pt.ef} W/bpm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

// ==========================================
// ACTIVITIES LIST VIEW
// ==========================================
interface ActivitiesListProps {
  activitiesResponse: ActivitiesResponse | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSelectActivity: (id: number) => void;
}

function ActivitiesListView({ 
  activitiesResponse, 
  currentPage, 
  onPageChange, 
  onSelectActivity 
}: ActivitiesListProps) {
  
  if (!activitiesResponse) return null;

  const { activities, total_pages } = activitiesResponse;

  return (
    <div className="card">
      <div className="card-title-container">
        <h3>
          <History size={18} style={{ color: 'var(--text-secondary)' }} />
          Recent Fitness Activities
        </h3>
        <span className="badge badge-outline">Page {currentPage} of {total_pages || 1}</span>
      </div>
      <p className="card-subtitle">
        Click on any activity to view advanced metrics like Normalized Power, intensity zones, and historical segment record progressions.
      </p>

      <div className="table-wrapper">
        <table className="activities-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Date</th>
              <th>Distance</th>
              <th>Duration</th>
              <th>Avg Power</th>
              <th>Avg HR</th>
            </tr>
          </thead>
          <tbody>
            {activities.map(act => (
              <tr key={act.id}>
                <td className="activity-name-cell" onClick={() => onSelectActivity(act.id)}>
                  {act.name}
                </td>
                <td>{formatDisplayDate(act.formatted_date || act.start_date_local)}</td>
                <td style={{ fontWeight: 700 }}>{act.distance_miles.toFixed(1)} mi</td>
                <td>{act.moving_time_str}</td>
                <td>{act.average_watts ? `${Math.round(act.average_watts)}W` : '--'}</td>
                <td>{act.average_heartrate ? `${Math.round(act.average_heartrate)} bpm` : '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-container">
        <button 
          className="btn-icon" 
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="page-info">
          Page {currentPage} of {total_pages || 1}
        </span>
        <button 
          className="btn-icon" 
          disabled={currentPage === total_pages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ==========================================
// AI COACH VIEW
// ==========================================
interface AICoachProps {
  athleteProfile: AthleteProfile | null;
  ftpHistory: { month: string; ftp: number }[];
  weeklyLoad: WeeklyLoad[];
}

function AICoachView({ athleteProfile, ftpHistory, weeklyLoad }: AICoachProps) {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<'base' | 'vo2' | 'threshold'>('threshold');
  const [duration, setDuration] = useState<14 | 21>(14);

  const handleGenerateCoachInsights = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY || "";
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY. Configure it under local environments.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        You are a professional cycling coach analyzing data for an athlete with the following profile:
        - Current FTP: ${athleteProfile?.estimatedFtp} Watts (Peak FTP: ${athleteProfile?.maxFtp} Watts)
        - Athlete Phenotype: ${athleteProfile?.athletePhenotype}
        - Current Fitness Level: ${athleteProfile?.currentFitnessLevel}
        - Aerobic Efficiency Average: ${athleteProfile?.aerobicEfficiencyAvg} W/bpm
        - Recent Form: CTL (Fitness) = ${athleteProfile?.recentForm.fitness}, ATL (Fatigue) = ${athleteProfile?.recentForm.fatigue}, TSB (Form/Balance) = ${athleteProfile?.recentForm.form} (${athleteProfile?.recentForm.status})
        
        Generate a highly structured ${duration}-day periodized training plan focused on: ${
          goal === 'base' ? 'Endurance and aerobic base building' : 
          goal === 'vo2' ? 'VO2 Max intervals and anaerobic capacity' : 'Lactate threshold (FTP) improvements'
        }.
        Include a quick summary paragraph analyzing the athlete's current fitness trends first, then write the daily plan (Day 1 to Day ${duration}) as markdown cards. Focus the training recommendations specifically on their current numbers and stats. Keep it concise, high-impact, and professional.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      if (result.text) {
        setResponse(result.text);
      } else {
        setResponse("Failed to generate response text. Please check your credentials.");
      }
    } catch (error: any) {
      console.error("AI Coach Error:", error);
      setResponse(error?.message || "An error occurred while generating training insights. Please confirm your API key is correct.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="ai-coach-banner">
        <div className="ai-coach-icon">
          <Sparkles size={28} />
        </div>
        <div className="ai-coach-title">
          <h3>Personalized AI Coach</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Our coaching engine reads your computed threshold trends, fatigue CTL/ATL, and efficiency averages to generate tailored workout suggestions.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Configure Training Focus</h3>
        <p className="card-subtitle">Select your athletic focus and training cycle duration to generate a customized structure.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', margin: '1.5rem 0' }}>
          <div className="form-group">
            <label className="form-label">Training Target</label>
            <select className="form-select" value={goal} onChange={(e: any) => setGoal(e.target.value)}>
              <option value="base">Aerobic Base Building</option>
              <option value="threshold">Lactate Threshold (FTP)</option>
              <option value="vo2">VO2 Max / Punchy Intervals</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cycle Duration</label>
            <select className="form-select" value={duration} onChange={(e: any) => setDuration(parseInt(e.target.value) as any)}>
              <option value="14">14-Day Block</option>
              <option value="21">21-Day Block</option>
            </select>
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
          onClick={handleGenerateCoachInsights}
          disabled={loading}
        >
          <Sparkles size={18} />
          {loading ? 'Analyzing Athletic Profile...' : 'Generate Athlete Progression Insights'}
        </button>
      </div>

      {response && (
        <div className="card" style={{ animation: 'slideIn 0.4s ease' }}>
          <h3>AI Training Plan & Performance Insights</h3>
          <div style={{ marginTop: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {/* Simple Markdown Rendering helper */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', whiteSpace: 'pre-wrap' }}>
              {response}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ==========================================
// ACTIVITY DETAILS MODAL
// ==========================================
interface ModalProps {
  activityId: number;
  activityDetails: ActivityDetails | null;
  loading: boolean;
  onClose: () => void;
  detectingGear: boolean;
  onDetectGear: (id: number) => void;
  ftp: number;
}

function ActivityDetailsModal({ 
  activityId, 
  activityDetails, 
  loading, 
  onClose,
  detectingGear,
  onDetectGear,
  ftp
}: ModalProps) {
  
  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-orange)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  if (!activityDetails) return null;

  const { activity, efforts } = activityDetails;

  // Calculate time in Power Zones (standard Coggan 6 zones based on FTP)
  // Zone 1: Active Recovery (< 55% FTP)
  // Zone 2: Endurance (55% - 75% FTP)
  // Zone 3: Tempo (76% - 90% FTP)
  // Zone 4: Lactate Threshold (91% - 105% FTP)
  // Zone 5: VO2 Max (106% - 120% FTP)
  // Zone 6: Anaerobic Capacity (> 120% FTP)
  const z1Threshold = Math.round(ftp * 0.55);
  const z2Threshold = Math.round(ftp * 0.75);
  const z3Threshold = Math.round(ftp * 0.90);
  const z4Threshold = Math.round(ftp * 1.05);
  const z5Threshold = Math.round(ftp * 1.20);

  // Approximate intensity distribution based on average watts & normalized power
  const averagePower = activity.average_watts || 150;
  const normPower = activity.norm_power || averagePower;

  // Generate mock distributions for rendering Zone Bars based on average values
  const getZoneDistribution = () => {
    if (averagePower < z1Threshold) return [80, 20, 0, 0, 0, 0];
    if (averagePower < z2Threshold) return [20, 60, 15, 5, 0, 0];
    if (averagePower < z3Threshold) return [15, 20, 50, 10, 5, 0];
    if (averagePower < z4Threshold) return [10, 15, 20, 45, 8, 2];
    return [5, 10, 15, 20, 40, 10];
  };

  const distributions = getZoneDistribution();
  const zoneLabels = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h3>{activity.name}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {formatDisplayDate(activity.formatted_date || activity.start_date_local, true)}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top Info Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="badge badge-outline" style={{ padding: '0.5rem 1rem' }}>
                Distance: {activity.distance_miles.toFixed(2)} mi
              </div>
              <div className="badge badge-outline" style={{ padding: '0.5rem 1rem' }}>
                Moving Time: {activity.moving_time_str}
              </div>
              {activity.average_speed_mph && (
                <div className="badge badge-outline" style={{ padding: '0.5rem 1rem' }}>
                  Avg Speed: {activity.average_speed_mph.toFixed(1)} mph
                </div>
              )}
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={() => onDetectGear(activity.id)}
              disabled={detectingGear}
            >
              {detectingGear ? 'Analyzing...' : 'Recalculate Athlete Metrics'}
            </button>
          </div>

          {/* Advanced Power Metrics & Power Curve Bests */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            
            {/* Intensity Stats Card */}
            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
              <h4>Advanced Stress Metrics</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Normalized Power (NP)</span>
                  <span style={{ fontWeight: 'bold' }}>{normPower ? `${Math.round(normPower)} W` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Intensity Factor (IF)</span>
                  <span style={{ fontWeight: 'bold' }}>{(normPower / ftp).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Average Heart Rate</span>
                  <span style={{ fontWeight: 'bold' }}>{activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Average Cadence</span>
                  <span style={{ fontWeight: 'bold' }}>{activity.average_cadence ? `${Math.round(activity.average_cadence)} rpm` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gear Tracked</span>
                  <span className="badge badge-brand">{activity.gear_name || 'No Bike'}</span>
                </div>
              </div>
            </div>

            {/* Peak Power Curve details */}
            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
              <h4>Ride Power Curve Records</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best 5s Power</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand-orange)' }}>{activity.best_5s ? `${Math.round(activity.best_5s)} W` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best 30s Power</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand-purple)' }}>{activity.best_30s ? `${Math.round(activity.best_30s)} W` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best 5m Power</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand-blue)' }}>{activity.best_5min ? `${Math.round(activity.best_5min)} W` : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Best 20m Power</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--brand-gold)' }}>{activity.best_20min ? `${Math.round(activity.best_20min)} W` : '--'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Training Intensity Zone Distributions */}
          <div className="card" style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
            <h4>Power Zone Intensity Distribution</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 500 }}>
              Calculated based on your FTP thresholds: Zone 1 (&lt;{z1Threshold}W), Zone 2 ({z1Threshold}-{z2Threshold}W), Zone 3 ({z2Threshold}-{z3Threshold}W), Zone 4 ({z3Threshold}-{z4Threshold}W), Zone 5 ({z4Threshold}-{z5Threshold}W), Zone 6 (&gt;{z5Threshold}W).
            </p>
            <div className="zone-dist-container">
              {distributions.map((val, idx) => (
                <div className="zone-row" key={idx}>
                  <span className="zone-label">{zoneLabels[idx]}</span>
                  <div className="zone-bar-bg">
                    <div className={`zone-bar-fill bg-zone${idx + 1}`} style={{ width: `${val}%` }} />
                  </div>
                  <span className="zone-value">{val}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Segment Records & Leaderboards */}
          {efforts && efforts.length > 0 && (
            <div className="card" style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem' }}>
              <h4>Segment Record & Rank Progression</h4>
              <p className="card-subtitle">Segment efforts matched during this ride, highlighting PR accomplishments.</p>
              
              <div className="table-wrapper" style={{ marginTop: '0.75rem' }}>
                <table className="activities-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '0.5rem 1.25rem' }}>Segment</th>
                      <th style={{ padding: '0.5rem 1.25rem' }}>Effort Time</th>
                      <th style={{ padding: '0.5rem 1.25rem' }}>Avg Power</th>
                      <th style={{ padding: '0.5rem 1.25rem' }}>Leaderboard Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {efforts.map(eff => {
                      const allTimeRank = eff.rankings?.all_time;
                      const sameGearRank = eff.rankings?.same_gear;
                      return (
                        <tr key={eff.id}>
                          <td style={{ fontWeight: 'bold', color: 'white', padding: '0.75rem 1.25rem' }}>{eff.segment_name}</td>
                          <td style={{ padding: '0.75rem 1.25rem' }}>{eff.time_str || formatTimeStr(eff.elapsed_time)}</td>
                          <td style={{ padding: '0.75rem 1.25rem' }}>{eff.average_watts ? `${Math.round(eff.average_watts)} W` : '--'}</td>
                          <td style={{ padding: '0.75rem 1.25rem' }}>
                            {allTimeRank ? (
                              <span className={`badge ${allTimeRank.rank === 1 ? 'badge-success' : 'badge-outline'}`} style={{ color: allTimeRank.rank === 1 ? 'var(--brand-gold)' : 'white', borderColor: allTimeRank.rank === 1 ? 'var(--brand-gold)' : 'var(--border-color)' }}>
                                Rank: {allTimeRank.rank} / {allTimeRank.total}
                              </span>
                            ) : '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

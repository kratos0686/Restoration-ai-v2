import React, { useState, useEffect } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Wind, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';

interface WeatherWidgetProps {
    address: string;
}

interface WeatherData {
    temperature: number;
    windspeed: number;
    weathercode: number;
}

interface WeatherAlert {
    severity: 'info' | 'warning' | 'danger';
    title: string;
    description: string;
    ends: string;
}

interface WeatherAlertData {
    hasAlerts: boolean;
    alerts: WeatherAlert[];
    summary: string;
    citations?: { title: string; url: string }[];
}

export default function WeatherWidget({ address }: WeatherWidgetProps) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Alerts state
    const [alertsData, setAlertsData] = useState<WeatherAlertData | null>(null);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [showAlerts, setShowAlerts] = useState(false);

    useEffect(() => {
        const fetchWeather = async () => {
            if (!address) {
                setLoading(false);
                return;
            }
            
            setLoading(true);
            setError(null);
            try {
                let lat: number | null = null;
                let lng: number | null = null;

                // Check if address is coordinates
                const coordsMatch = address.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
                if (coordsMatch) {
                    lat = parseFloat(coordsMatch[1]);
                    lng = parseFloat(coordsMatch[3]);
                } else {
                    // Try geocoding
                    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`);
                    if (!geoRes.ok) throw new Error('Geocoding failed');
                    const geoData = await geoRes.json();
                    
                    if (geoData.results && geoData.results.length > 0) {
                        lat = geoData.results[0].latitude;
                        lng = geoData.results[0].longitude;
                    }
                }

                if (lat !== null && lng !== null) {
                    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&temperature_unit=fahrenheit&windspeed_unit=mph`);
                    if (!weatherRes.ok) throw new Error('Weather fetch failed');
                    const weatherData = await weatherRes.json();
                    
                    if (weatherData.current_weather) {
                        setWeather(weatherData.current_weather);
                    }
                } else {
                    setError('Location not found');
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load weather');
            } finally {
                setLoading(false);
            }
        };

        const fetchAlerts = async () => {
            if (!address) return;
            setLoadingAlerts(true);
            try {
                const res = await fetch('/api/ai/weather-alerts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setAlertsData(data);
                }
            } catch (err) {
                console.error('Failed to fetch weather alerts:', err);
            } finally {
                setLoadingAlerts(false);
            }
        };

        fetchWeather();
        fetchAlerts();
    }, [address]);

    if (loading) {
        return <div className="p-3 bg-slate-900 rounded-xl border border-white/5 animate-pulse h-16 w-full"></div>;
    }

    if (error || !weather) {
        return null; // Silently fail or return small error state
    }

    // Map WMO weather codes to icons
    // https://open-meteo.com/en/docs
    const getWeatherIcon = (code: number) => {
        if (code === 0) return <Sun size={20} className="text-yellow-400" />;
        if (code === 1 || code === 2 || code === 3) return <Cloud size={20} className="text-slate-300" />;
        if (code === 45 || code === 48) return <CloudFog size={20} className="text-slate-400" />;
        if (code >= 51 && code <= 67) return <CloudRain size={20} className="text-blue-400" />;
        if (code >= 71 && code <= 77) return <CloudSnow size={20} className="text-slate-100" />;
        if (code >= 80 && code <= 82) return <CloudRain size={20} className="text-blue-400" />;
        if (code >= 85 && code <= 86) return <CloudSnow size={20} className="text-slate-100" />;
        if (code >= 95) return <CloudLightning size={20} className="text-yellow-500" />;
        return <Sun size={20} className="text-yellow-400" />;
    };

    const getWeatherDesc = (code: number) => {
        if (code === 0) return "Clear sky";
        if (code === 1 || code === 2 || code === 3) return "Partly cloudy";
        if (code === 45 || code === 48) return "Fog";
        if (code >= 51 && code <= 55) return "Drizzle";
        if (code >= 61 && code <= 67) return "Rain";
        if (code >= 71 && code <= 77) return "Snow";
        if (code >= 80 && code <= 82) return "Rain showers";
        if (code >= 85 && code <= 86) return "Snow showers";
        if (code >= 95) return "Thunderstorm";
        return "Unknown";
    };

    const getSeverityColor = (severity: 'info' | 'warning' | 'danger') => {
        if (severity === 'danger') return 'text-red-400 bg-red-950/40 border-red-900/40';
        if (severity === 'warning') return 'text-amber-400 bg-amber-950/40 border-amber-900/40';
        return 'text-sky-400 bg-sky-950/40 border-sky-900/40';
    };

    return (
        <div id="weather-widget-card" className="p-3 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                        {getWeatherIcon(weather.weathercode)}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{weather.temperature}&deg;F</span>
                            {alertsData?.hasAlerts && (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            {getWeatherDesc(weather.weathercode)}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Wind size={10} /> <span>{weather.windspeed} mph</span>
                    </div>
                </div>
            </div>

            {/* AI Severe Weather Alerts Section */}
            {loadingAlerts && (
                <div className="pt-2 border-t border-white/5 flex items-center space-x-2 text-[10px] text-slate-400 animate-pulse">
                    <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Checking severe alerts...</span>
                </div>
            )}

            {!loadingAlerts && alertsData && (
                <div className="pt-2 border-t border-white/5 space-y-2">
                    {alertsData.hasAlerts ? (
                        <div className="space-y-2">
                            <button
                                onClick={() => setShowAlerts(!showAlerts)}
                                className="w-full flex items-center justify-between p-2 bg-red-950/20 hover:bg-red-950/30 border border-red-900/30 rounded-lg text-left transition-colors cursor-pointer"
                            >
                                <div className="flex items-center space-x-2 text-[11px] font-bold text-red-400">
                                    <AlertTriangle size={12} className="animate-bounce" />
                                    <span>{alertsData.alerts.length} Severe Alerts Active</span>
                                </div>
                                <div className="text-red-400">
                                    {showAlerts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </div>
                            </button>

                            {showAlerts && (
                                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                    {/* AI Threat Summary */}
                                    {alertsData.summary && (
                                        <div className="p-2 bg-slate-850/60 rounded-lg border border-white/5">
                                            <div className="flex items-start space-x-1.5">
                                                <Info size={11} className="text-blue-400 mt-0.5 shrink-0" />
                                                <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                                                    {alertsData.summary}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Detailed Alert List */}
                                    {alertsData.alerts.map((alert, i) => (
                                        <div key={i} className={`p-2.5 border rounded-lg space-y-1 ${getSeverityColor(alert.severity)}`}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wide">{alert.title}</h4>
                                                <span className="text-[8px] opacity-80 uppercase font-black">Ends: {alert.ends}</span>
                                            </div>
                                            <p className="text-[10px] leading-relaxed opacity-90 font-sans">{alert.description}</p>
                                        </div>
                                    ))}

                                    {/* Grounding Citations */}
                                    {alertsData.citations && alertsData.citations.length > 0 && (
                                        <div className="pt-1.5 space-y-1">
                                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Grounded Sources</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {alertsData.citations.map((cite, i) => (
                                                    <a
                                                        key={i}
                                                        href={cite.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        referrerPolicy="no-referrer"
                                                        className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded text-[9px] border border-white/5 transition-all"
                                                    >
                                                        <span>{cite.title}</span>
                                                        <ExternalLink size={8} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 p-2 bg-slate-850/30 rounded-lg border border-white/5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[10px] text-slate-400 font-medium">No severe weather alerts active for this site.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


'use client';

import React, { useState, useEffect } from 'react';
import TeamCard from './TeamCard';

const LiveScoring = () => {
  const [matchId, setMatchId] = useState('1986333136274618368');
  const [clientId, setClientId] = useState('abaf75ac-98ce-49bf-ba57-f49229989ee6');
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [teamNamesInput, setTeamNamesInput] = useState('Team 1\nTeam 2\nTeam 3');
  const [jsonFilePath, setJsonFilePath] = useState(''); // File path state
  const [jsonWriteStatus, setJsonWriteStatus] = useState(null); // Status for JSON writing
  const [logoFolderPath, setLogoFolderPath] = useState('D:\\Production Assets\\team logos'); // Logo folder path
  const [hpFolderPath, setHpFolderPath] = useState('D:\\Production Assets\\Alive health pins'); // NEW: HP images folder path
  const [zoneInImage, setZoneInImage] = useState('D:\\Production Assets\\INZONE\\100001.png');
  const [zoneOutImage, setZoneOutImage] = useState('D:\\Production Assets\\OUTZONE\\100001.png');


  // Silent background update function (no loading state)
  const fetchLiveScoringSilent = async () => {
    if (!matchId || !clientId) return;

    try {
      const response = await fetch(
        `/api/live-scoring?matchid=${encodeURIComponent(matchId)}&clientid=${encodeURIComponent(clientId)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Don't show error for silent updates, just skip
        return;
      }

      const data = await response.json();
      setLiveData(data?.match_stats);
    } catch (err) {
      // Silently fail for background updates
      console.error('Silent update failed:', err);
    }
  };

  // Manual fetch with loading state (for button click)
  const fetchLiveScoring = async () => {
    if (!matchId || !clientId) {
      setError('Please enter both Match ID and Client ID');
      return;
    }

    setLoading(true);
    setError(null);
    setIsInitialLoad(true);

    try {
      const response = await fetch(
        `/api/live-scoring?matchid=${encodeURIComponent(matchId)}&clientid=${encodeURIComponent(clientId)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setLiveData(data?.match_stats);
      setIsInitialLoad(false);
    } catch (err) {
      setError(err.message || 'Failed to fetch live scoring data');
      setLiveData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on component mount with default values
  useEffect(() => {
    fetchLiveScoring();
  }, []);

  // Auto-refresh every 3 seconds (silent background updates)
  useEffect(() => {
    // Only start auto-refresh if we have data (initial load completed)
    if (!liveData) return;

    const interval = setInterval(() => {
      if (matchId && clientId) {
        fetchLiveScoringSilent(); // Silent update, no loading state
      }
    }, 3000); // 3 seconds

    return () => clearInterval(interval);
  }, [matchId, clientId, liveData]); // Include liveData to restart when data is available

  // NEW: Helper function to get HP value for a player (0-200)
  const getPlayerHP = (player) => {
    if (player.hp_info?.current_hp !== undefined) {
      return Math.max(0, Math.min(200, Math.round(player.hp_info.current_hp))); // Clamp between 0-200
    }
    return 0;
  };

  // NEW: Function to generate vMix-compatible JSON
  const generateVmixJson = () => {
    // Calculate teams inside this function to avoid initialization issues
    const currentTeams = getFilteredTeams();

    if (!liveData || !currentTeams.length) return null;

    // Calculate total kills for each team and sort by kills (highest first)
    const teamsWithKills = currentTeams.map(team => {
      const totalKills = team.player_stats?.reduce((sum, player) => sum + (player.kills || 0), 0) || team.kill_count || 0;
      return {
        ...team,
        totalKills: totalKills
      };
    });

    // Sort teams by kills (highest first)
    const sortedTeams = [...teamsWithKills].sort((a, b) => b.totalKills - a.totalKills);

    const jsonData = {};
    const zoneIn = zoneInImage.trim();
    const zoneOut = zoneOutImage.trim();

    // Generate Team names (Team1, Team2, Team3) - capital T
    sortedTeams.forEach((team, index) => {
      const teamName = team.team_name || `Team ${index + 1}`;
      const position = index + 1;
      jsonData[`Team${position}`] = teamName;
    });

    // Generate Logo paths (Logo1, Logo2, Logo3) - capital L
    sortedTeams.forEach((team, index) => {
      const teamName = team.team_name || `Team ${index + 1}`;
      const position = index + 1;

      if (logoFolderPath.trim()) {
        // Normalize team name for file path (remove spaces, special chars)
        const normalizedTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const basePath = logoFolderPath.replace(/[\\/]+$/, '');
        const separator = basePath.includes('\\') ? '\\' : '/';
        const logoPath = `${basePath}${separator}${normalizedTeamName}.png`;
        jsonData[`Logo${position}`] = logoPath;
      } else {
        jsonData[`Logo${position}`] = '';
      }
    });

    // Generate FINISHES (FIN1, FIN2, FIN3) - based on total kill points
    sortedTeams.forEach((team, index) => {
      const position = index + 1;
      jsonData[`FIN${position}`] = team.totalKills || 0;
    });

    // Generate Zone image paths (ZONE1, ZONE2, ...) - positioned before win rates
    sortedTeams.forEach((team, index) => {
      const anyPlayerOutside = team.player_stats?.some((player) => player.is_in_safe_zone === false);
      jsonData[`ZONE${index + 1}`] = anyPlayerOutside ? zoneOut || '' : zoneIn || '';
    });

    // Generate Win Rates (WinRate1, WinRate2, ...)
    sortedTeams.forEach((team, index) => {
      const position = index + 1;
      const winRate = team.win_rate ?? 0;
      jsonData[`WINRATE${position}`] = typeof winRate === 'number' ? winRate : parseFloat(winRate) || 0;
    });

    // Generate HP IMAGE PATHS for each team (only include existing players)
    // Team 1 players: T1P1, T1P2, T1P3, T1P4 (HP image path) - only if players exist
    // Team 2 players: T2P1, T2P2, T2P3, T2P4
    // For solo tournaments: only T1P1 will be shown if there's only 1 player
    sortedTeams.forEach((team, teamIndex) => {
      const teamNumber = teamIndex + 1;
      const players = team.player_stats || [];
      
      console.log(`Team ${teamNumber} has ${players.length} players, hpFolderPath:`, hpFolderPath);
      
      // Only include players that actually exist (no empty slots)
      if (players.length > 0) {
        players.slice(0, 4).forEach((player, playerIndex) => {
          const playerNumber = playerIndex + 1;
          const playerHP = getPlayerHP(player);
          
          console.log(`Player ${playerNumber} HP:`, playerHP, 'Player data:', player);
          
          // HP image path directly in T1P1, T1P2, etc.
          if (hpFolderPath && hpFolderPath.trim()) {
            // Check if player is knocked down (player_state = 2)
            // If knocked down, use negative HP value (e.g., -70.png instead of 70.png)
            let hpValue = playerHP;
            if (player.player_state === 2) {
              hpValue = -playerHP; // Make it negative for knockdown
            }

            const basePath = hpFolderPath.replace(/[\\/]+$/, '');
            const separator = basePath.includes('\\') ? '\\' : '/';
            const hpImagePath = `${basePath}${separator}${hpValue}.png`;
            jsonData[`T${teamNumber}P${playerNumber}`] = hpImagePath;
            console.log(`Set T${teamNumber}P${playerNumber} to:`, hpImagePath, `(player_state: ${player.player_state})`);
          } else {
            jsonData[`T${teamNumber}P${playerNumber}`] = '';
            console.log(`HP folder path not set, T${teamNumber}P${playerNumber} is empty`);
          }
        });
      } else {
        console.log(`Team ${teamNumber} has no players`);
      }
      
      // Removed: No longer filling empty slots with 0.png
      // This way, solo tournaments will only show T1P1, not T1P2, T1P3, T1P4
    });

    // Return as array with single object
    return [jsonData];
  };
  // NEW: Function to write JSON to file
  const writeJsonToFile = async () => {
    if (!jsonFilePath.trim()) {
      setJsonWriteStatus({ type: 'error', message: 'Please enter a file path' });
      return;
    }

    const jsonData = generateVmixJson();
    if (!jsonData) {
      setJsonWriteStatus({ type: 'error', message: 'No data available to write' });
      return;
    }

    try {
      setJsonWriteStatus({ type: 'loading', message: 'Writing JSON file...' });
      
      const response = await fetch('/api/write-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: jsonFilePath,
          jsonData: jsonData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to write JSON file');
      }

      setJsonWriteStatus({ type: 'success', message: result.message });
    } catch (err) {
      setJsonWriteStatus({ type: 'error', message: err.message });
    }
  };

  // NEW: Auto-write JSON when data updates (if file path is set)
  useEffect(() => {
    const currentTeams = getFilteredTeams();
    if (liveData && currentTeams.length > 0 && jsonFilePath.trim()) {
      // Use a small delay to avoid too frequent writes
      const timeoutId = setTimeout(() => {
        writeJsonToFile();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [liveData, teamNamesInput, jsonFilePath, logoFolderPath, hpFolderPath, zoneInImage, zoneOutImage]);

  // Helper function to extract players/teams from data
  const extractScoringData = (data) => {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data;
    }
    
    if (data.players && Array.isArray(data.players)) {
      return data.players;
    }
    
    if (data.teams && Array.isArray(data.teams)) {
      return data.teams;
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    if (data.match && data.match.players) {
      return data.match.players;
    }

    if (typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data);
      if (entries.length > 0 && typeof entries[0][0] === 'string') {
        return entries.map(([key, value]) => ({ id: key, ...value }));
      }
    }

    return [];
  };

  // Helper function to get player name
  const getPlayerName = (player) => {
    return player.name || player.playerName || player.username || player.nickname || player.id || 'Unknown';
  };

  // Helper function to get value safely
  const getValue = (obj, ...keys) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return '-';
  };

  const extractTeams = (data) => {
    if (!data) return [];
    
    if (Array.isArray(data)) {
      const match = data[0];
      if (match && match.team_stats && Array.isArray(match.team_stats)) {
        return match.team_stats;
      }
    }
    
    if (data.team_stats && Array.isArray(data.team_stats)) {
      return data.team_stats;
    }
    
    if (data.match_stats && Array.isArray(data.match_stats)) {
      const match = data.match_stats[0];
      if (match && match.team_stats) {
        return match.team_stats;
      }
    }
    
    return [];
  };

  // Parse team names from input and assign IDs
  const parseTeamNames = () => {
    if (!teamNamesInput.trim()) return [];
    
    return teamNamesInput
      .split('\n')
      .map((name, index) => ({
        id: index + 1,
        name: name.trim()
      }))
      .filter(team => team.name.length > 0);
  };

  // Get filtered teams based on entered team names
  const getFilteredTeams = () => {
    const allTeams = extractTeams(liveData);
    const parsedTeamNames = parseTeamNames();
    
    if (parsedTeamNames.length === 0) {
      return allTeams; // If no team names entered, show all teams
    }

    // Map teams from API response to entered team names by matching team_id
    return parsedTeamNames.map(parsedTeam => {
      // Find team from API response where team_id matches the assigned ID
      const matchingTeam = allTeams.find(team => {
        const apiTeamId = team.team_id || team.id;
        return apiTeamId === parsedTeam.id;
      });

      // If found, return the team with the assigned ID and entered name
      if (matchingTeam) {
        return {
          ...matchingTeam,
          assigned_id: parsedTeam.id,
          team_name: parsedTeam.name // Use the entered name
        };
      }

      // Return placeholder team if not found in API response
      return {
        assigned_id: parsedTeam.id,
        team_name: parsedTeam.name,
        team_id: parsedTeam.id,
        player_stats: [],
        kill_count: 0,
        ranking_score: 0
      };
    });
  };

  // NEW: Helper function to get logo path for a team
  const getTeamLogoPath = (teamName) => {
    if (!logoFolderPath.trim() || !teamName) return null;
    
    // Normalize team name for file path (remove spaces, special chars)
    const normalizedTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    // Construct logo path: folderPath/teamname.png
    const basePath = logoFolderPath.replace(/[\\/]+$/, '');
    const separator = basePath.includes('\\') ? '\\' : '/';
    const logoPath = `${basePath}${separator}${normalizedTeamName}.png`;
    console.log('Generated logo path:', logoPath, 'for team:', teamName);
    return logoPath;
  };

 
  const teams = getFilteredTeams();
  const scoringData = extractScoringData(liveData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 drop-shadow-2xl mb-3">
              Free Fire
            </h1>
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 rounded-full mx-auto w-32"></div>
          </div>
          <p className="text-slate-400 text-lg font-medium">Live Scoring System • Real-time match statistics</p>
        </div>

        {/* NEW: JSON File Path Section */}
        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-4">
            📁 vMix JSON Export
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Logo Folder Path
              </label>
              <input
                type="text"
                value={logoFolderPath}
                onChange={(e) => setLogoFolderPath(e.target.value)}
                placeholder="/Users/username/Desktop/logos or D:/Production Assets/team logos"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg font-mono text-sm mb-4"
              />
              <p className="text-slate-400 text-xs mb-4">
                Enter the folder path where logo images are stored. Logo files should be named as team name (e.g., soul.png, rntx.png)
              </p>
            </div>

            {/* NEW: HP Images Folder Path */}
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                HP Images Folder Path
              </label>
              <input
                type="text"
                value={hpFolderPath}
                onChange={(e) => setHpFolderPath(e.target.value)}
                placeholder="/Users/username/Desktop/hp-images or D:/Production Assets/hp images"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg font-mono text-sm mb-4"
              />
              <p className="text-slate-400 text-xs mb-4">
                Enter the folder path where HP images are stored. HP files should be named as numbers from 0-200 (e.g., 0.png, 70.png, 200.png)
              </p>
            </div>

            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Zone In Image Link
              </label>
              <input
                type="text"
                value={zoneInImage}
                onChange={(e) => setZoneInImage(e.target.value)}
                placeholder="https://example.com/in-zone.png"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg font-mono text-sm mb-4"
              />
              <p className="text-slate-400 text-xs mb-4">
                Provide the full image URL to display when a team is inside the safe zone.
              </p>
            </div>

            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Zone Out Image Link
              </label>
              <input
                type="text"
                value={zoneOutImage}
                onChange={(e) => setZoneOutImage(e.target.value)}
                placeholder="https://example.com/out-zone.png"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg font-mono text-sm mb-4"
              />
              <p className="text-slate-400 text-xs mb-4">
                Provide the full image URL to display when a team is outside the safe zone.
              </p>
            </div>

            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                JSON File Path (Save Location)
              </label>
              <input
                type="text"
                value={jsonFilePath}
                onChange={(e) => setJsonFilePath(e.target.value)}
                placeholder="/Users/username/Desktop/vimix or /Users/username/Desktop/vimix/data.json"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg font-mono text-sm"
              />
              <p className="text-slate-400 text-xs mt-2">
                Enter folder path (will create data.json) or full file path. This file will auto-update every 3 seconds.
              </p>
            </div>
            
            <button
              onClick={writeJsonToFile}
              disabled={!jsonFilePath.trim() || !liveData}
              className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-green-600 via-emerald-600 to-green-500 hover:from-green-500 hover:via-emerald-500 hover:to-green-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-green-500/50 transform hover:scale-105 active:scale-95"
            >
              💾 Write JSON File (Manual)
            </button>

            {jsonWriteStatus && (
              <div className={`px-4 py-3 rounded-xl ${
                jsonWriteStatus.type === 'success' 
                  ? 'bg-green-900/50 border-2 border-green-700 text-green-100'
                  : jsonWriteStatus.type === 'error'
                  ? 'bg-red-900/50 border-2 border-red-700 text-red-100'
                  : 'bg-blue-900/50 border-2 border-blue-700 text-blue-100'
              }`}>
                <p className="text-sm font-semibold">
                  {jsonWriteStatus.type === 'success' && '✅ '}
                  {jsonWriteStatus.type === 'error' && '❌ '}
                  {jsonWriteStatus.type === 'loading' && '⏳ '}
                  {jsonWriteStatus.message}
                </p>
              </div>
            )}

            {/* Preview of JSON data */}
            {liveData && getFilteredTeams().length > 0 && (
              <div className="mt-4">
                <p className="text-slate-300 text-sm font-semibold mb-2">
                  JSON Preview (Teams sorted by kills - highest first):
                </p>
                <div className="bg-slate-900/80 rounded-xl p-4 overflow-x-auto border border-slate-700">
                  <pre className="text-green-400 text-xs font-mono">
                    {JSON.stringify(generateVmixJson(), null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Names Input Section - NEW */}
        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <label className="block text-slate-200 text-sm font-semibold mb-3">
            Team Names (one per line)
          </label>
          <textarea
            value={teamNamesInput}
            onChange={(e) => setTeamNamesInput(e.target.value)}
            placeholder="Team 1&#10;Team 2&#10;Team 3"
            rows={6}
            className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg font-mono text-sm resize-y"
          />
          <p className="text-slate-400 text-xs mt-2">
            Enter team names, one per line. Teams will be assigned IDs automatically (1, 2, 3...)
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Match ID
              </label>
              <input
                type="text"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="Enter Match ID"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg"
              />
            </div>
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter Client ID"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg"
              />
            </div>
          </div>
          <button
            onClick={fetchLiveScoring}
            disabled={loading}
            className="w-full md:w-auto px-10 py-3.5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-600 hover:from-blue-500 hover:via-blue-400 hover:to-cyan-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-blue-500/50 transform hover:scale-105 active:scale-95"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Fetching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                🔄 Fetch Live Score
              </span>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-r from-red-900/90 to-red-800/90 border-2 border-red-700 text-red-100 px-5 py-4 rounded-xl mb-6 shadow-xl backdrop-blur-sm">
            <p className="font-bold text-lg mb-1">⚠️ Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Loading State - Only show on initial load */}
        {loading && isInitialLoad && !liveData && (
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-2xl p-16 text-center border border-slate-700/50 shadow-2xl">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-blue-500 mb-6"></div>
            <p className="text-white text-xl font-semibold">Loading live scoring data...</p>
          </div>
        )}

        {/* Teams Display Section with Flex Layout */}
        {liveData && teams.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 mb-2">
                  Teams
                </h2>
                <p className="text-slate-400 text-sm font-medium">
                  Live team statistics and player status • Showing {teams.length} team(s)
                </p>
              </div>
              <span className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm font-black rounded-full animate-pulse shadow-xl border-2 border-red-500/50">
                🔴 LIVE
              </span>
            </div>
            
            {/* Flex Container for Teams */}
            <div className="flex flex-wrap gap-6 justify-center md:justify-start">
              {teams.map((team, index) => (
                <div key={team.assigned_id || team.team_id || index} className="flex-shrink-0" style={{ minWidth: '340px', maxWidth: '400px', flex: '1 1 340px' }}>
                  <TeamCard team={team} logoPath={getTeamLogoPath(team.team_name)} />
                </div>
              ))}
            </div>
          </div>
        )}

      

      

      
      </div>
    </div>
  );
};

export default LiveScoring;

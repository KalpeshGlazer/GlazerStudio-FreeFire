'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const sanitizeGroupName = (name) => {
  if (typeof name !== 'string') return '';
  return name.trim();
};

const sanitizeFileName = (value, fallback = 'match-summary') => {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '_');
  return cleaned || fallback;
};

const sanitizeLabel = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const DEFAULT_GROUP_NAME = 'GroupA';
const DEFAULT_ROUND_LABEL = 'R1';
const DEFAULT_MATCH_LABEL = 'M1';

const incrementMatchLabel = (label) => {
  const sanitized = sanitizeLabel(label, DEFAULT_MATCH_LABEL) || DEFAULT_MATCH_LABEL;
  const match = sanitized.match(/^([^\d]*)(\d+)?$/);

  if (!match) {
    return DEFAULT_MATCH_LABEL;
  }

  const prefix = match[1] || 'M';
  const numericPart = match[2];
  const nextNumber = numericPart ? parseInt(numericPart, 10) + 1 : 2;
  const padded =
    numericPart && numericPart.length > 1
      ? String(nextNumber).padStart(numericPart.length, '0')
      : String(nextNumber);

  return `${prefix}${padded}`;
};

const buildMatchCompositeKey = (group, round, match) => {
  return [group, round, match].map((value) => sanitizeFileName(value || '')).join('::');
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
const normalizeTeamNameKey = (name) => {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase();
};
const resolveTeamBaseName = (team, index = 0) => {
  const preferredCandidates = [
    team?.original_team_name,
    team?.originalTeamName,
    team?.raw?.original_team_name,
    team?.raw?.team_name,
    team?.raw?.teamName,
  ];

  for (const candidate of preferredCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const candidates = [
    team?.team_name,
    team?.teamName,
    team?.name,
    team?.display_name,
    team?.displayName,
    team?.short_name,
    team?.shortName,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const numericId =
    team?.team_id ?? team?.assigned_id ?? team?.id ?? (Number.isFinite(index) ? index + 1 : null);

  if (numericId !== null && numericId !== undefined) {
    return `Team ${numericId}`;
  }

  return `Team ${index + 1}`;
};
const ROUND_ROBIN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const createDefaultRoundRobinConfig = (groupCount = 3, teamsPerGroup = 2) => {
  const sanitizedGroupCount = Math.max(1, Math.min(Number(groupCount) || 1, ROUND_ROBIN_ALPHABET.length));
  const sanitizedTeamsPerGroup = Math.max(1, Number(teamsPerGroup) || 1);

  return {
    groupCount: sanitizedGroupCount,
    teamsPerGroup: sanitizedTeamsPerGroup,
    groups: Array.from({ length: sanitizedGroupCount }, (_, index) => ({
      name: `Group ${ROUND_ROBIN_ALPHABET[index] || index + 1}`,
      teams: Array.from({ length: sanitizedTeamsPerGroup }, () => ''),
      enabled: true,
    })),
  };
};

const normalizeRoundRobinConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return createDefaultRoundRobinConfig();
  }

  const desiredGroupCount = Math.max(
    1,
    Math.min(Number(config.groupCount) || 1, ROUND_ROBIN_ALPHABET.length)
  );
  const desiredTeamsPerGroup = Math.max(1, Number(config.teamsPerGroup) || 1);

  const groups = Array.from({ length: desiredGroupCount }, (_, index) => {
    const existingGroup = Array.isArray(config.groups) ? config.groups[index] : undefined;
    const name =
      existingGroup && typeof existingGroup.name === 'string' && existingGroup.name.trim().length > 0
        ? existingGroup.name
        : `Group ${ROUND_ROBIN_ALPHABET[index] || index + 1}`;

    const teams = Array.from({ length: desiredTeamsPerGroup }, (_, teamIndex) => {
      if (existingGroup && Array.isArray(existingGroup.teams)) {
        const existingTeam = existingGroup.teams[teamIndex];
        if (typeof existingTeam === 'string') {
          return existingTeam;
        }
      }
      return '';
    });

    return {
      name,
      teams,
      enabled: existingGroup && typeof existingGroup.enabled === 'boolean' ? existingGroup.enabled : true,
    };
  });

  return {
    groupCount: desiredGroupCount,
    teamsPerGroup: desiredTeamsPerGroup,
    groups,
  };
};
import TeamCard from './TeamCard';
import TournamentFormatSelector from './TournamentFormatSelector';

const LiveScoring = () => {
  const [matchId, setMatchId] = useState('1986333136274618368');
  const [clientId, setClientId] = useState('abaf75ac-98ce-49bf-ba57-f49229989ee6');
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [teamNameOverrides, setTeamNameOverrides] = useState({});
  const [teamNameSuggestions, setTeamNameSuggestions] = useState([]);
  const [jsonFilePath, setJsonFilePath] = useState(''); // File path state
  const [jsonWriteStatus, setJsonWriteStatus] = useState(null); // Status for JSON writing
  const [logoFolderPath, setLogoFolderPath] = useState('D:\\Production Assets\\team logos'); // Logo folder path
  const [hpFolderPath, setHpFolderPath] = useState('D:\\Production Assets\\Alive health pins'); // NEW: HP images folder path
  const [zoneInImage, setZoneInImage] = useState('D:\\Production Assets\\INZONE\\100001.png');
  const [zoneOutImage, setZoneOutImage] = useState('D:\\Production Assets\\OUTZONE\\100001.png');
  const [cumulativeScores, setCumulativeScores] = useState({});
  const [matchHistory, setMatchHistory] = useState([]);
  const [matchSaveStatus, setMatchSaveStatus] = useState(null);
  const [groupName, setGroupName] = useState(DEFAULT_GROUP_NAME);
  const [groupDataMap, setGroupDataMap] = useState(() => ({
    [DEFAULT_GROUP_NAME]: {
      cumulativeScores: {},
      matchHistory: [],
      roundLabel: DEFAULT_ROUND_LABEL,
      matchLabel: DEFAULT_MATCH_LABEL,
    },
  }));
  const [roundLabel, setRoundLabel] = useState(DEFAULT_ROUND_LABEL);
  const [matchLabel, setMatchLabel] = useState(DEFAULT_MATCH_LABEL);
  const [manualTeamSlots, setManualTeamSlots] = useState({});
  const [tournamentFormat, setTournamentFormat] = useState('linear');
  const [roundRobinConfig, setRoundRobinConfig] = useState(() => createDefaultRoundRobinConfig());
  const [configTransferStatus, setConfigTransferStatus] = useState(null);
  const configFileInputRef = useRef(null);
  const sourceTeams = useMemo(() => extractTeams(liveData), [liveData]);
  const roundRobinTeamOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    if (roundRobinConfig && Array.isArray(roundRobinConfig.groups)) {
      roundRobinConfig.groups.forEach((group) => {
        if (group && group.enabled === false) {
          return;
        }
        if (!group || !Array.isArray(group.teams)) return;
        group.teams.forEach((teamName) => {
          const sanitized = sanitizeLabel(teamName);
          if (!sanitized) return;
          const key = sanitized.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          options.push(sanitized);
        });
      });
    }

    return options;
  }, [roundRobinConfig]);

  const persistGroupData = useCallback(
    (groupKey, payload) => {
      const normalized = sanitizeGroupName(groupKey);
      if (!normalized || !payload || typeof payload !== 'object') {
        return;
      }

      setGroupDataMap((prev) => {
        const existing = prev?.[normalized] || {};
        const merged = {
          ...existing,
          ...payload,
        };

        try {
          if (JSON.stringify(existing) === JSON.stringify(merged)) {
            return prev;
          }
        } catch (err) {
          // If serialization fails, continue with update.
          console.error('Failed to compare group data payloads:', err);
        }

        return {
          ...prev,
          [normalized]: merged,
        };
      });
    },
    [setGroupDataMap]
  );

  const handleTournamentFormatChange = useCallback((nextFormat) => {
    setTournamentFormat(nextFormat === 'roundRobin' ? 'roundRobin' : 'linear');
  }, []);

  const handleRoundRobinConfigChange = useCallback((nextConfig) => {
    setRoundRobinConfig(normalizeRoundRobinConfig(nextConfig));
  }, []);

  const handleRoundRobinGroupToggle = useCallback((groupIndex, isEnabled) => {
    setRoundRobinConfig((prev) => {
      const normalized = normalizeRoundRobinConfig(prev);
      const groups = normalized.groups.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              enabled: isEnabled,
            }
          : group
      );
      return {
        ...normalized,
        groups,
      };
    });
  }, []);

  const handleTriggerConfigImport = useCallback(() => {
    if (configFileInputRef.current) {
      configFileInputRef.current.value = '';
      configFileInputRef.current.click();
    }
  }, []);

  const handleExportConfiguration = useCallback(() => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        matchId,
        clientId,
        isInitialLoad,
        liveData,
        teamNameSuggestions,
        matchSaveStatus,
        jsonWriteStatus,
        tournamentFormat,
        roundRobinConfig,
        groupName,
        roundLabel,
        matchLabel,
        groupDataMap,
        teamNameOverrides,
        manualTeamSlots,
        cumulativeScores,
        matchHistory,
        jsonFilePath,
        logoFolderPath,
        hpFolderPath,
        zoneInImage,
        zoneOutImage,
      };

      const serialized = JSON.stringify(payload, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `live-scoring-export-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setConfigTransferStatus({
        type: 'success',
        message: 'Configuration exported successfully.',
      });
    } catch (err) {
      console.error('Failed to export configuration:', err);
      setConfigTransferStatus({
        type: 'error',
        message: 'Failed to export configuration.',
      });
    }
  }, [
    tournamentFormat,
    roundRobinConfig,
    groupName,
    roundLabel,
    matchLabel,
    groupDataMap,
    teamNameOverrides,
    manualTeamSlots,
    cumulativeScores,
    matchHistory,
    jsonFilePath,
    logoFolderPath,
    hpFolderPath,
    zoneInImage,
    zoneOutImage,
  ]);

  const handleImportedConfiguration = useCallback(
    (parsed) => {
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid configuration format.');
      }

      const importedFormat = parsed.tournamentFormat === 'roundRobin' ? 'roundRobin' : 'linear';
      setTournamentFormat(importedFormat);

      if (parsed.roundRobinConfig) {
        setRoundRobinConfig(normalizeRoundRobinConfig(parsed.roundRobinConfig));
      }

      if (typeof parsed.matchId === 'string' || typeof parsed.matchId === 'number') {
        setMatchId(String(parsed.matchId));
      }

      if (typeof parsed.clientId === 'string' || typeof parsed.clientId === 'number') {
        setClientId(String(parsed.clientId));
      }

      if (parsed.groupDataMap && typeof parsed.groupDataMap === 'object') {
        setGroupDataMap(() => {
          const sanitized = {};
          Object.entries(parsed.groupDataMap).forEach(([key, value]) => {
            if (typeof key !== 'string' || !key.trim()) {
              return;
            }
            if (!value || typeof value !== 'object') {
              return;
            }
            sanitized[sanitizeGroupName(key)] = {
              cumulativeScores: value.cumulativeScores || {},
              matchHistory: Array.isArray(value.matchHistory) ? value.matchHistory : [],
              roundLabel: value.roundLabel || DEFAULT_ROUND_LABEL,
              matchLabel: value.matchLabel || DEFAULT_MATCH_LABEL,
              lastUpdatedAt: value.lastUpdatedAt || null,
              lastExportedFile: value.lastExportedFile || '',
              lastCompletedMatchLabel: value.lastCompletedMatchLabel || '',
            };
          });
          return Object.keys(sanitized).length > 0
            ? sanitized
            : {
                [DEFAULT_GROUP_NAME]: {
                  cumulativeScores: {},
                  matchHistory: [],
                  roundLabel: DEFAULT_ROUND_LABEL,
                  matchLabel: DEFAULT_MATCH_LABEL,
                },
              };
        });
      }

      if (parsed.teamNameOverrides && typeof parsed.teamNameOverrides === 'object') {
        setTeamNameOverrides(parsed.teamNameOverrides);
      }

      if (parsed.manualTeamSlots && typeof parsed.manualTeamSlots === 'object') {
        setManualTeamSlots(parsed.manualTeamSlots);
      }

      if (Array.isArray(parsed.teamNameSuggestions)) {
        setTeamNameSuggestions(parsed.teamNameSuggestions);
      }

      const importedGroupName = sanitizeGroupName(parsed.groupName) || DEFAULT_GROUP_NAME;
      const importedRoundLabel = sanitizeLabel(parsed.roundLabel, DEFAULT_ROUND_LABEL) || DEFAULT_ROUND_LABEL;
      const importedMatchLabel = sanitizeLabel(parsed.matchLabel, DEFAULT_MATCH_LABEL) || DEFAULT_MATCH_LABEL;

      setGroupName(importedGroupName);
      setRoundLabel(importedRoundLabel);
      setMatchLabel(importedMatchLabel);

      if (Array.isArray(parsed.matchHistory)) {
        setMatchHistory(parsed.matchHistory);
      }

      if (parsed.cumulativeScores && typeof parsed.cumulativeScores === 'object') {
        setCumulativeScores(parsed.cumulativeScores);
      }

      if (typeof parsed.isInitialLoad === 'boolean') {
        setIsInitialLoad(parsed.isInitialLoad);
      }

      if (parsed.liveData && typeof parsed.liveData === 'object') {
        setLiveData(parsed.liveData);
      }

      if (parsed.matchSaveStatus && typeof parsed.matchSaveStatus === 'object') {
        setMatchSaveStatus(parsed.matchSaveStatus);
      }

      if (parsed.jsonWriteStatus && typeof parsed.jsonWriteStatus === 'object') {
        setJsonWriteStatus(parsed.jsonWriteStatus);
      }

      if (typeof parsed.jsonFilePath === 'string') {
        setJsonFilePath(parsed.jsonFilePath);
      }

      if (typeof parsed.logoFolderPath === 'string') {
        setLogoFolderPath(parsed.logoFolderPath);
      }

      if (typeof parsed.hpFolderPath === 'string') {
        setHpFolderPath(parsed.hpFolderPath);
      }

      if (typeof parsed.zoneInImage === 'string') {
        setZoneInImage(parsed.zoneInImage);
      }

      if (typeof parsed.zoneOutImage === 'string') {
        setZoneOutImage(parsed.zoneOutImage);
      }

      setConfigTransferStatus({
        type: 'success',
        message: 'Configuration imported successfully.',
      });
    },
    []
  );

  const handleConfigImportChange = useCallback(
    (event) => {
      const file = event?.target?.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const text = loadEvent?.target?.result;
          if (typeof text !== 'string') {
            throw new Error('Unable to read configuration file.');
          }
          const parsed = JSON.parse(text);
          handleImportedConfiguration(parsed);
        } catch (err) {
          console.error('Failed to import configuration:', err);
          setConfigTransferStatus({
            type: 'error',
            message: 'Failed to import configuration. Please verify the file.',
          });
        }
      };
      reader.readAsText(file);
    },
    [handleImportedConfiguration]
  );

  const handleActiveGroupChange = useCallback(
    (value) => {
      const cleanValue = sanitizeGroupName(value);
      setGroupName(cleanValue);

      if (!cleanValue) {
        setCumulativeScores({});
        setMatchHistory([]);
        setRoundLabel(DEFAULT_ROUND_LABEL);
        setMatchLabel(DEFAULT_MATCH_LABEL);
        return;
      }

      const payload = groupDataMap?.[cleanValue];

      if (payload) {
        const nextHistory = Array.isArray(payload.matchHistory) ? payload.matchHistory : [];
        const recalculated = recalculateCumulativeFromHistory(nextHistory);
        const nextScores =
          recalculated && Object.keys(recalculated).length > 0
            ? recalculated
            : payload.cumulativeScores && typeof payload.cumulativeScores === 'object'
            ? payload.cumulativeScores
            : {};
        const nextRound =
          sanitizeLabel(payload.roundLabel, DEFAULT_ROUND_LABEL) || DEFAULT_ROUND_LABEL;
        const nextMatch =
          sanitizeLabel(payload.matchLabel, DEFAULT_MATCH_LABEL) || DEFAULT_MATCH_LABEL;

        setCumulativeScores(nextScores);
        setMatchHistory(nextHistory);
        setRoundLabel(nextRound);
        setMatchLabel(nextMatch);
      } else {
        setCumulativeScores({});
        setMatchHistory([]);
        setRoundLabel(DEFAULT_ROUND_LABEL);
        setMatchLabel(DEFAULT_MATCH_LABEL);
        persistGroupData(cleanValue, {
          cumulativeScores: {},
          matchHistory: [],
          roundLabel: DEFAULT_ROUND_LABEL,
          matchLabel: DEFAULT_MATCH_LABEL,
        });
      }
    },
    [groupDataMap, persistGroupData]
  );


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
    const currentTeams = getFilteredTeams();

    if (!liveData || !currentTeams.length) return null;

    const scoreEntries = cumulativeScores && typeof cumulativeScores === 'object' ? cumulativeScores : {};

    const findCumulativeEntryForTeam = (team) => {
      if (!team) return null;

      const attempts = [];
      const name = typeof team.team_name === 'string' ? team.team_name.trim() : '';
      if (name) {
        attempts.push(name, name.toLowerCase());
      }

      const originalName =
        typeof team.original_team_name === 'string' ? team.original_team_name.trim() : '';
      if (originalName && originalName !== name) {
        attempts.push(originalName, originalName.toLowerCase());
      }

      const teamId = team.team_id ?? team.assigned_id ?? team.id;
      if (teamId !== null && teamId !== undefined) {
        const idString = String(teamId).trim();
        if (idString) {
          attempts.push(idString, `team-${idString}`, `Team ${idString}`);
        }
      }

      for (const key of attempts) {
        if (!key) continue;
        if (scoreEntries[key]) {
          return scoreEntries[key];
        }
      }

      if (name) {
        const normalized = name.toLowerCase();
        const matched = Object.entries(scoreEntries).find(([key, value]) => {
          const candidates = [];
          if (typeof key === 'string') {
            candidates.push(key.trim().toLowerCase());
          }
          if (value && typeof value.teamName === 'string') {
            candidates.push(value.teamName.trim().toLowerCase());
          }
          return candidates.some((candidate) => candidate === normalized);
        });

        if (matched) {
          return matched[1];
        }
      }

      return null;
    };

    const resolvePreviousTotalPoints = (entry) => {
      if (!entry || typeof entry !== 'object') return 0;
      const previous = Number(entry.previousTotalPoints);
      if (Number.isFinite(previous) && previous >= 0) {
        return previous;
      }
      const total = Number(entry.totalPoints);
      if (Number.isFinite(total) && total >= 0) {
        return total;
      }
      return 0;
    };

    const teamsWithStats = currentTeams.map((team) => {
      const totalKills =
        (Array.isArray(team.player_stats)
          ? team.player_stats.reduce((sum, player) => sum + (Number(player.kills) || 0), 0)
          : 0) || Number(team.kill_count) || 0;

      const { killPoints, placementPoints, totalPoints: currentMatchTotal } = calculateTeamPoints(team);
      const cumulativeEntry = findCumulativeEntryForTeam(team);
      const previousTotal = resolvePreviousTotalPoints(cumulativeEntry);
      const safeCurrentTotal = Number.isFinite(currentMatchTotal) ? currentMatchTotal : 0;
      const combinedTotal = previousTotal + safeCurrentTotal;

      return {
        ...team,
        totalKills,
        killPoints,
        placementPoints,
        currentMatchTotalPoints: safeCurrentTotal,
        previousTotalPoints: previousTotal,
        combinedTotalPoints: Number.isFinite(combinedTotal) ? combinedTotal : 0,
      };
    });

    // Sort teams by combined total points (previous cumulative + current match), break ties by kills
    const sortedTeams = [...teamsWithStats].sort((a, b) => {
      const diff = (b.combinedTotalPoints || 0) - (a.combinedTotalPoints || 0);
      if (diff !== 0) return diff;
      return (b.totalKills || 0) - (a.totalKills || 0);
    });

    const jsonData = {};
    const zoneIn = zoneInImage.trim();
    const zoneOut = zoneOutImage.trim();

    const totalSlots = Math.max(sortedTeams.length, 12);
    const baseLogoPath = logoFolderPath.trim() ? logoFolderPath.replace(/[\\/]+$/, '') : '';
    const logoSeparator = baseLogoPath.includes('\\') ? '\\' : '/';
    const baseHpPath = hpFolderPath && hpFolderPath.trim() ? hpFolderPath.replace(/[\\/]+$/, '') : '';
    const hpSeparator = baseHpPath.includes('\\') ? '\\' : '/';

    const slots = Array.from({ length: totalSlots }, (_, index) => {
      const position = index + 1;
      const team = sortedTeams[index] || null;
      const manualName = manualTeamSlots[position] || '';
      const teamName = team ? team.team_name || `Team ${position}` : manualName;
      const hasTeamData = Boolean(team);

      let logoPath = '';
      if (baseLogoPath) {
        const normalizedTeamName = teamName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const logoFileName = normalizedTeamName ? `${normalizedTeamName}.png` : 'default.png';
        logoPath = `${baseLogoPath}${logoSeparator}${logoFileName}`;
      }

      const finValue = hasTeamData ? team.totalKills || 0 : 0;
      const totalPointsValue =
        hasTeamData && Number.isFinite(team.combinedTotalPoints)
          ? Math.round(team.combinedTotalPoints)
          : 0;

      let zoneValue = zoneIn || '';
      if (hasTeamData) {
        const relevantPlayers = (team.player_stats || []).filter(
          (player) => player?.player_state !== 1
        );
        const anyPlayerOutside = relevantPlayers.some((player) => player.is_in_safe_zone === false);
        zoneValue = anyPlayerOutside ? zoneOut || zoneIn || '' : zoneIn || '';
      }

      let winRateValue = '0%';
      if (hasTeamData) {
        const winRate = team.win_rate ?? 0;
        const winRateNumeric = typeof winRate === 'number' ? winRate : parseFloat(winRate) || 0;
        const normalizedWinRate = Number.isFinite(winRateNumeric) ? winRateNumeric : 0;
        winRateValue = `${normalizedWinRate}%`;
      }

      const hpPaths = Array.from({ length: 4 }, (_, playerIndex) => {
        const player =
          hasTeamData && Array.isArray(team.player_stats) ? team.player_stats[playerIndex] : null;

        if (player && baseHpPath) {
          const playerHP = getPlayerHP(player);
          let hpValue = playerHP;
          if (player.player_state === 2) {
            hpValue = -playerHP;
          }
          const hpImagePath = `${baseHpPath}${hpSeparator}${hpValue}.png`;
          console.log(
            `Set T${position}P${playerIndex + 1} to:`,
            hpImagePath,
            ` (player_state: ${player.player_state})`
          );
          return hpImagePath;
        }

        if (baseHpPath) {
          return `${baseHpPath}${hpSeparator}0.png`;
        }

        return '';
      });

      return {
        position,
        teamName,
        rank: `#${position}`,
        logoPath,
        finValue,
        totalPointsValue,
        zoneValue,
        winRateValue,
        hpPaths,
      };
    });

    // Maintain JSON key order: Teams, Ranks, Logos, FIN, TOTAL, ZONE, WINRATE, HP entries
    slots.forEach(({ position, teamName }) => {
      jsonData[`Team${position}`] = teamName;
    });

    slots.forEach(({ position, rank }) => {
      jsonData[`RANK${position}`] = rank;
    });

    slots.forEach(({ position, logoPath }) => {
      jsonData[`Logo${position}`] = logoPath;
    });

    slots.forEach(({ position, finValue }) => {
      jsonData[`FIN${position}`] = finValue;
    });

    slots.forEach(({ position, totalPointsValue }) => {
      jsonData[`TOTAL${position}`] = totalPointsValue;
    });

    slots.forEach(({ position, zoneValue }) => {
      jsonData[`ZONE${position}`] = zoneValue;
    });

    slots.forEach(({ position, winRateValue }) => {
      jsonData[`WINRATE${position}`] = winRateValue;
    });

    slots.forEach(({ position, hpPaths }) => {
      hpPaths.forEach((hpPath, playerIndex) => {
        jsonData[`T${position}P${playerIndex + 1}`] = hpPath;
      });
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
  }, [liveData, teamNameOverrides, jsonFilePath, logoFolderPath, hpFolderPath, zoneInImage, zoneOutImage]);

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

  useEffect(() => {
    if (!liveData) {
      return;
    }

    const allTeams = extractTeams(liveData);

    if (!Array.isArray(allTeams) || allTeams.length === 0) {
      return;
    }

    setTeamNameOverrides((prev) => {
      const next = {};

      allTeams.forEach((team, index) => {
        const baseName = resolveTeamBaseName(team, index);
        const key = normalizeTeamNameKey(baseName);
        if (!key) return;

        if (typeof prev[key] === 'string') {
          next[key] = prev[key];
        } else if (
          Array.isArray(teamNameSuggestions) &&
          typeof teamNameSuggestions[index] === 'string'
        ) {
          next[key] = teamNameSuggestions[index];
        } else {
          next[key] = '';
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);

      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every(
          (key) => Object.prototype.hasOwnProperty.call(next, key) && prev[key] === next[key]
        )
      ) {
        return prev;
      }

      return next;
    });
  }, [liveData, teamNameSuggestions]);

  const handleTeamOverrideChange = (baseName, value) => {
    const key = normalizeTeamNameKey(baseName);
    if (!key) return;

    setTeamNameOverrides((prev) => {
      if (prev[key] === value) {
        return prev;
      }
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleManualTeamSlotChange = (position, value) => {
    setManualTeamSlots((prev) => {
      if (prev[position] === value) {
        return prev;
      }
      return {
        ...prev,
        [position]: value,
      };
    });
  };

  const getFilteredTeams = () => {
    const allTeams = extractTeams(liveData);

    const normalizedTeams = Array.isArray(allTeams) ? allTeams : [];

    const mappedTeams = normalizedTeams.map((team, index) => {
      const baseName = resolveTeamBaseName(team, index);
      const key = normalizeTeamNameKey(baseName);
      const overrideValue =
        key && typeof teamNameOverrides[key] === 'string' ? teamNameOverrides[key] : '';
      const finalName =
        typeof overrideValue === 'string' && overrideValue.trim().length > 0
          ? overrideValue.trim()
          : baseName;

      return {
        ...team,
        assigned_id:
          team?.assigned_id ??
          team?.team_id ??
          team?.id ??
          (Number.isFinite(index) ? index + 1 : undefined),
        team_name: finalName,
        original_team_name: baseName,
      };
    });

    const manualEntries = Object.entries(manualTeamSlots || {})
      .map(([position, value]) => {
        const trimmedName = typeof value === 'string' ? value.trim() : '';
        if (!trimmedName) {
          return null;
        }

        const numericPosition = Number(position);
        const assignedId = Number.isFinite(numericPosition)
          ? `manual-${numericPosition}`
          : `manual-${position}`;

        return {
          position: Number.isFinite(numericPosition) ? numericPosition : mappedTeams.length + 1,
          data: {
            assigned_id: assignedId,
            team_id: assignedId,
            team_name: trimmedName,
            original_team_name: trimmedName,
            manualPlaceholder: true,
            player_stats: [],
            kill_count: 0,
            ranking_score: 0,
            rank_points: 0,
            placement_points: 0,
            position_points: 0,
            total_points: 0,
            total_score: 0,
            points: 0,
            score: 0,
            booyah: false,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.position - b.position)
      .map((entry, index) => ({
        ...entry.data,
        display_order: entry.position ?? mappedTeams.length + index + 1,
      }));

    if (!mappedTeams.length && !manualEntries.length) {
      return [];
    }

    return [...mappedTeams, ...manualEntries];
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

  const calculateTeamPoints = (team) => {
    const killsFromPlayers = Array.isArray(team.player_stats)
      ? team.player_stats.reduce((sum, player) => sum + (Number(player.kills) || 0), 0)
      : 0;

    const killCountValue = Number(team.kill_count);
    const killPoints = Number.isFinite(killCountValue) ? killCountValue : killsFromPlayers;

    const placementCandidates = [
      team.ranking_score,
      team.rank_points,
      team.placement_points,
      team.position_points,
    ];

    const placementPointsCandidate = placementCandidates
      .map((value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      })
      .find((value) => value !== null);

    let placementPoints = placementPointsCandidate ?? 0;

    const totalCandidates = [
      team.total_points,
      team.total_score,
      team.points,
      team.score,
    ];

    const providedTotal = totalCandidates
      .map((value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      })
      .find((value) => value !== null);

    let totalPoints;
    if (providedTotal !== null && providedTotal !== undefined) {
      totalPoints = providedTotal;
      if ((!placementPoints || placementPoints === 0) && killPoints !== undefined) {
        const derivedPlacement = providedTotal - (Number.isFinite(killPoints) ? killPoints : 0);
        placementPoints = Number.isFinite(derivedPlacement) ? Math.max(0, derivedPlacement) : 0;
      }
    } else {
      totalPoints = (Number.isFinite(killPoints) ? killPoints : 0) + placementPoints;
    }

    return {
      killPoints: Number.isFinite(killPoints) ? killPoints : 0,
      placementPoints: Number.isFinite(placementPoints) ? placementPoints : 0,
      totalPoints: Number.isFinite(totalPoints) ? totalPoints : 0,
    };
  };

  const isBooyahTeam = (team) => {
    if (!team) return false;
    if (team.booyah !== undefined) return Boolean(team.booyah);

    const rankCandidates = [
      team.rank_position,
      team.rank,
      team.placement,
      team.position,
      team.ranking,
    ];

    return rankCandidates
      .map((value) => Number(value))
      .some((numeric) => Number.isFinite(numeric) && numeric === 1);
  };

  const buildMatchSummary = () => {
    const currentTeams = getFilteredTeams();
    if (!currentTeams.length) return [];

    return currentTeams.map((team) => {
      const { killPoints, placementPoints, totalPoints } = calculateTeamPoints(team);
      const teamId = team.team_id ?? team.assigned_id ?? team.id ?? null;
      const defaultName = teamId !== null ? `Team ${teamId}` : 'Unknown Team';

      return {
        teamId,
        teamName: team.team_name || defaultName,
        killPoints,
        placementPoints,
        totalPoints,
        booyah: isBooyahTeam(team),
        raw: team,
      };
    });
  };

  const recalculateCumulativeFromHistory = (history) => {
    if (!Array.isArray(history) || history.length === 0) {
      return {};
    }

    const aggregate = {};

    const sortedHistory = [...history].sort((a, b) => {
      const timeA = new Date(a?.savedAt || 0).getTime();
      const timeB = new Date(b?.savedAt || 0).getTime();
      return timeA - timeB;
    });

    sortedHistory.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;

      const timestamp = entry.savedAt;
      const matchIdentifier = entry.matchId || entry.matchIdentifier || entry.matchKey || null;
      const teams = Array.isArray(entry.teams) ? entry.teams : [];

      teams.forEach((teamSummary) => {
        const key =
          teamSummary.teamName ||
          (teamSummary.teamId !== null && teamSummary.teamId !== undefined
            ? `team-${teamSummary.teamId}`
            : null);

        if (!key) return;

        const baseName =
          teamSummary.teamName ||
          (teamSummary.teamId !== null && teamSummary.teamId !== undefined
            ? `Team ${teamSummary.teamId}`
            : 'Unknown Team');

        const existing = aggregate[key] || {
          teamId: teamSummary.teamId,
          teamName: baseName,
          matches: 0,
          killPoints: 0,
          placementPoints: 0,
          totalPoints: 0,
          booyahCount: 0,
          lastMatchAt: null,
          lastMatchIdentifier: null,
          previousTotalPoints: 0,
          lastMatchPoints: 0,
        };

        const matchKillPoints = Number(teamSummary.killPoints) || 0;
        const matchPlacementPoints = Number(teamSummary.placementPoints) || 0;
        const matchTotalPoints =
          Number(teamSummary.totalPoints) ||
          matchKillPoints + matchPlacementPoints;
        const previousTotal = existing.totalPoints || 0;

        aggregate[key] = {
          ...existing,
          teamId: teamSummary.teamId,
          teamName: baseName,
          matches: existing.matches + 1,
          killPoints: existing.killPoints + matchKillPoints,
          placementPoints: existing.placementPoints + matchPlacementPoints,
          totalPoints: previousTotal + matchTotalPoints,
          booyahCount: existing.booyahCount + (teamSummary.booyah ? 1 : 0),
          lastMatchAt: timestamp || existing.lastMatchAt,
          lastMatchIdentifier: matchIdentifier || existing.lastMatchIdentifier,
          previousTotalPoints: previousTotal,
          lastMatchPoints: matchTotalPoints,
        };

        if (teamSummary.booyah) {
          aggregate[key].lastBooyahAt = timestamp || aggregate[key].lastBooyahAt || null;
          aggregate[key].lastBooyahMatch = matchIdentifier || aggregate[key].lastBooyahMatch || null;
        }
      });
    });

    return aggregate;
  };

  const buildGroupExportPayload = (groupKey, overrideData = {}) => {
    const cleanGroupName = sanitizeGroupName(groupKey);
    if (!cleanGroupName) return null;

    const currentHistory = Array.isArray(overrideData.matchHistory)
      ? overrideData.matchHistory
      : Array.isArray(matchHistory)
      ? matchHistory
      : [];
    const currentScores =
      overrideData.cumulativeScores && Object.keys(overrideData.cumulativeScores || {}).length > 0
        ? overrideData.cumulativeScores
        : Object.keys(cumulativeScores || {}).length > 0
        ? cumulativeScores
        : recalculateCumulativeFromHistory(currentHistory);

    const timestamp = new Date().toISOString();
    const exportRound = sanitizeLabel(overrideData.roundLabel ?? roundLabel, '');
    const exportMatch = sanitizeLabel(overrideData.matchLabel ?? matchLabel, '');

    return {
      version: 2,
      updatedAt: timestamp,
      groupName: cleanGroupName,
      roundLabel: exportRound,
      matchLabel: exportMatch,
      matchCount: currentHistory.length,
      cumulativeScores: currentScores,
      matchHistory: currentHistory,
    };
  };

  const triggerBrowserDownload = (data, filenameHint) => {
    try {
      const serialized = JSON.stringify(data, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sanitizeFileName(filenameHint || 'match-summary') + '.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.error('Failed to trigger download:', err);
      return false;
    }
  };

  const exportJsonWithPicker = async (data, suggestedBaseName) => {
    try {
      const serialized = JSON.stringify(data, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const defaultFileName =
        sanitizeFileName(suggestedBaseName || 'match-summary') + '.json';

      if (typeof window !== 'undefined' && window.showSaveFilePicker) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [
              {
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          return {
            success: true,
            fileName: fileHandle.name,
            message: `Saved as ${fileHandle.name}`,
          };
        } catch (err) {
          if (err && (err.name === 'AbortError' || err.code === 20)) {
            return {
              success: false,
              cancelled: true,
              message: 'Save cancelled.',
            };
          }
          console.error('showSaveFilePicker failed:', err);
        }
      }

      const fallbackSuccess = triggerBrowserDownload(data, suggestedBaseName);
      return {
        success: fallbackSuccess,
        fileName: defaultFileName,
        message: fallbackSuccess
          ? 'Download triggered (check your downloads folder).'
          : 'Download failed.',
        fallback: true,
      };
    } catch (err) {
      console.error('Failed to export JSON:', err);
      return {
        success: false,
        message: err?.message || 'Failed to export JSON.',
      };
    }
  };

  const handleSaveMatchResults = async () => {
    const cleanGroupName = sanitizeGroupName(groupName);
    const cleanRoundLabel = sanitizeLabel(roundLabel, DEFAULT_ROUND_LABEL);
    const cleanMatchLabel = sanitizeLabel(matchLabel, DEFAULT_MATCH_LABEL);

    if (!cleanGroupName || !cleanRoundLabel || !cleanMatchLabel) {
      setMatchSaveStatus({
        type: 'error',
        message: 'Please enter Group, Round, and Match names before saving.',
      });
      return;
    }

    const matchSummary = buildMatchSummary();

    if (!matchSummary.length) {
      setMatchSaveStatus({ type: 'error', message: 'No team data available to save yet.' });
      return;
    }

    const timestamp = new Date().toISOString();
    const matchIdentifier = matchId || `match-${timestamp}`;
    const booyahTeamName = matchSummary.find((team) => team.booyah)?.teamName || null;
    const suggestedFileNameParts = [
      sanitizeFileName(cleanGroupName),
      sanitizeFileName(cleanRoundLabel),
      sanitizeFileName(cleanMatchLabel),
    ].filter(Boolean);
    const suggestedFileBase = suggestedFileNameParts.join('_') || 'match-summary';
    const matchKey = buildMatchCompositeKey(cleanGroupName, cleanRoundLabel, cleanMatchLabel);

    const newHistoryEntry = {
      matchId: matchIdentifier,
      matchKey,
      clientId,
      savedAt: timestamp,
      booyahTeam: booyahTeamName,
      groupName: cleanGroupName,
      roundLabel: cleanRoundLabel,
      matchLabel: cleanMatchLabel,
      teams: matchSummary.map(({ raw, ...summary }) => summary),
    };

    const existingIndex = matchHistory.findIndex((entry) => {
      if (!entry) return false;
      if (entry.matchKey && entry.matchKey === matchKey) return true;
      const entryRound = sanitizeLabel(entry.roundLabel, '');
      const entryMatch = sanitizeLabel(entry.matchLabel, '');
      return entryRound === cleanRoundLabel && entryMatch === cleanMatchLabel;
    });

    let updatedHistory;
    const isUpdate = existingIndex >= 0;

    if (isUpdate) {
      updatedHistory = matchHistory.map((entry, index) =>
        index === existingIndex
          ? { ...entry, ...newHistoryEntry }
          : entry
      );
    } else {
      updatedHistory = [...matchHistory, newHistoryEntry];
    }

    // Sort history by savedAt ascending to maintain chronological order
    updatedHistory = [...updatedHistory].sort((a, b) => {
      const timeA = new Date(a?.savedAt || 0).getTime();
      const timeB = new Date(b?.savedAt || 0).getTime();
      return timeA - timeB;
    });

    const recalculatedScores = recalculateCumulativeFromHistory(updatedHistory);

    setMatchHistory(updatedHistory);
    setCumulativeScores(recalculatedScores);

    const baseGroupPayload = {
      cumulativeScores: recalculatedScores,
      matchHistory: updatedHistory,
      lastUpdatedAt: timestamp,
      lastMatchId: matchIdentifier,
      lastMatchKey: matchKey,
      roundLabel: cleanRoundLabel,
      matchLabel: cleanMatchLabel,
      lastCompletedMatchLabel: cleanMatchLabel,
    };

    persistGroupData(cleanGroupName, baseGroupPayload);

    setMatchSaveStatus({
      type: 'loading',
      message: `Exporting ${cleanGroupName} • ${cleanRoundLabel} • ${cleanMatchLabel}...`,
    });

    const exportPayload = buildGroupExportPayload(cleanGroupName, {
      cumulativeScores: recalculatedScores,
      matchHistory: updatedHistory,
      roundLabel: cleanRoundLabel,
      matchLabel: cleanMatchLabel,
    });

    if (!exportPayload) {
      setMatchSaveStatus({
        type: 'error',
        message: 'Unable to prepare export payload.',
      });
      return;
    }

    const exportResult = await exportJsonWithPicker(exportPayload, suggestedFileBase);

    if (exportResult.success) {
      persistGroupData(cleanGroupName, {
        ...baseGroupPayload,
        lastExportedFile: exportResult.fileName || `${suggestedFileBase}.json`,
        lastCompletedMatchLabel: cleanMatchLabel,
      });

      setMatchSaveStatus({
        type: 'success',
        message: `${isUpdate ? 'Updated' : 'Saved'} ${cleanGroupName} • ${cleanRoundLabel} • ${cleanMatchLabel} (${exportResult.fileName || `${suggestedFileBase}.json`}).`,
      });
      return;
    }

    if (exportResult.cancelled) {
      setMatchSaveStatus({
        type: 'info',
        message: `Export cancelled. Standings updated for ${cleanGroupName} • ${cleanRoundLabel} • ${cleanMatchLabel} (browser only).`,
      });
      return;
    }

    setMatchSaveStatus({
      type: 'error',
      message:
        exportResult.message ||
        `Failed to export ${cleanGroupName} • ${cleanRoundLabel} • ${cleanMatchLabel}.`,
    });
  };

  const handleNextMatch = () => {
    const currentTeams = getFilteredTeams();

    const resetTeams =
      Array.isArray(currentTeams) && currentTeams.length > 0
        ? currentTeams
            .filter((team) => !team?.manualPlaceholder)
            .map((team) => {
            const resetPlayerStats = Array.isArray(team.player_stats)
              ? team.player_stats.map((player) => {
                  const totalHp =
                    (player?.hp_info && Number(player.hp_info.total_hp)) || 200;

                  return {
                    ...player,
                    kills: 0,
                    player_state: 0,
                    hp_info: {
                      ...(player?.hp_info || {}),
                      current_hp: totalHp,
                      total_hp: totalHp,
                    },
                  };
                })
              : [];

            return {
              ...team,
              kill_count: 0,
              ranking_score: 0,
              rank_points: 0,
              placement_points: 0,
              position_points: 0,
              total_points: 0,
              total_score: 0,
              points: 0,
              score: 0,
              booyah: false,
              player_stats: resetPlayerStats,
            };
          })
        : [];

    if (resetTeams.length > 0) {
      setLiveData([{ team_stats: resetTeams }]);
    } else {
      setLiveData(null);
    }

    const cleanGroupName = sanitizeGroupName(groupName);
    const timestamp = new Date().toISOString();
    const currentMatchLabel = sanitizeLabel(matchLabel, DEFAULT_MATCH_LABEL);
    const nextMatchLabel = incrementMatchLabel(currentMatchLabel);
    const currentRoundLabel = sanitizeLabel(roundLabel, DEFAULT_ROUND_LABEL);

    if (cleanGroupName) {
      const updatedScores = Object.entries(cumulativeScores || {}).reduce(
        (acc, [key, value]) => {
          const totalPoints = value?.totalPoints || 0;
          acc[key] = {
            ...value,
            killPoints: 0,
            placementPoints: 0,
            previousTotalPoints: totalPoints,
            lastMatchPoints: 0,
          };
          return acc;
        },
        {}
      );

      setCumulativeScores(updatedScores);
      persistGroupData(cleanGroupName, {
        cumulativeScores: updatedScores,
        matchHistory,
        lastUpdatedAt: timestamp,
        roundLabel: currentRoundLabel,
        matchLabel: nextMatchLabel,
        lastCompletedMatchLabel: currentMatchLabel,
      });
    }

    setMatchId('');
    setMatchSaveStatus(null);
    setJsonWriteStatus(null);
    setError(null);
    setIsInitialLoad(true);
    setLoading(false);
    setRoundLabel(currentRoundLabel);
    setMatchLabel(nextMatchLabel);
  };
 
  const handleJsonUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (uploadEvent) => {
      try {
        const fileContent = uploadEvent.target?.result;
        if (!fileContent || typeof fileContent !== 'string') {
          throw new Error('Invalid file content');
        }

        const parsed = JSON.parse(fileContent);

        const importedScores =
          parsed.cumulativeScores && typeof parsed.cumulativeScores === 'object' && !Array.isArray(parsed.cumulativeScores)
            ? parsed.cumulativeScores
            : {};

        const importedHistory = Array.isArray(parsed.matchHistory)
          ? parsed.matchHistory
          : Array.isArray(parsed.history)
          ? parsed.history
          : [];

        const importedPath =
          typeof parsed.filePath === 'string'
            ? parsed.filePath
            : typeof parsed.exportPath === 'string'
            ? parsed.exportPath
            : '';

        const importedGroupName =
          sanitizeGroupName(
            parsed.groupName ||
              parsed.group ||
              parsed?.metadata?.groupName ||
              parsed?.metadata?.group ||
              groupName
          ) || 'Group A';
        const importedRoundLabel =
          sanitizeLabel(
            parsed.roundLabel ||
              parsed.round ||
              parsed?.metadata?.roundLabel ||
              parsed?.meta?.roundLabel ||
              roundLabel,
            DEFAULT_ROUND_LABEL
          ) || DEFAULT_ROUND_LABEL;
        const importedMatchLabel =
          sanitizeLabel(
            parsed.matchLabel ||
              parsed.match ||
              parsed?.metadata?.matchLabel ||
              parsed?.meta?.matchLabel ||
              matchLabel,
            DEFAULT_MATCH_LABEL
          ) || DEFAULT_MATCH_LABEL;
        const nextMatchLabel = incrementMatchLabel(importedMatchLabel);

        const normalizedHistory = [...importedHistory].sort((a, b) => {
          const timeA = new Date(a?.savedAt || 0).getTime();
          const timeB = new Date(b?.savedAt || 0).getTime();
          return timeA - timeB;
        });

        const recalculatedFromImport = recalculateCumulativeFromHistory(normalizedHistory);
        const resolvedScores =
          recalculatedFromImport && Object.keys(recalculatedFromImport).length > 0
            ? recalculatedFromImport
            : importedScores;

        setCumulativeScores(resolvedScores);
        setMatchHistory(normalizedHistory);
        setGroupName(importedGroupName);
        setRoundLabel(importedRoundLabel);
        setMatchLabel(nextMatchLabel);

        const importedTimestamp =
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : typeof parsed.savedAt === 'string'
            ? parsed.savedAt
            : new Date().toISOString();

        persistGroupData(importedGroupName, {
          cumulativeScores: resolvedScores,
          matchHistory: normalizedHistory,
          lastUpdatedAt: importedTimestamp,
          lastExportedFile: parsed.resolvedFilePath || importedPath || '',
          roundLabel: importedRoundLabel,
          matchLabel: nextMatchLabel,
          lastCompletedMatchLabel: importedMatchLabel,
        });

        const importedTeamNames = Array.from(
          new Set(
            Object.values(resolvedScores || {})
              .map((entry) => entry?.teamName)
              .filter((name) => typeof name === 'string' && name.trim().length > 0)
          )
        );

        if (importedTeamNames.length > 0) {
          setTeamNameSuggestions(importedTeamNames);
        }

        setMatchSaveStatus({
          type: 'success',
          message: `Imported standings for ${importedGroupName} from ${file.name}`,
        });
      } catch (err) {
        console.error('Failed to import match summary JSON:', err);
        setMatchSaveStatus({ type: 'error', message: 'Failed to import JSON file. Please verify the format.' });
      }
    };

    reader.readAsText(file);

    // Allow the same file to be selected again later
    event.target.value = '';
  };

 
  const teams = getFilteredTeams();
  const scoringData = extractScoringData(liveData);
  const booyahTeam = teams.find((team) => isBooyahTeam(team));
  const savedGroupNames = Object.keys(groupDataMap || {})
    .filter((name) => typeof name === 'string' && name.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  const cumulativeScoresList = Object.values(cumulativeScores || {}).map((entry) => ({
    teamId: entry.teamId ?? null,
    teamName: entry.teamName || 'Unknown Team',
    matches: entry.matches || 0,
    killPoints: entry.killPoints || 0,
    placementPoints: entry.placementPoints || 0,
    totalPoints: entry.totalPoints || 0,
    booyahCount: entry.booyahCount || 0,
    lastMatchAt: entry.lastMatchAt || null,
    previousTotalPoints: entry.previousTotalPoints || 0,
    lastMatchPoints: entry.lastMatchPoints || 0,
  })).sort((a, b) => b.totalPoints - a.totalPoints);

  const currentMatchKeyLabel = [
    sanitizeFileName(sanitizeGroupName(groupName) || ''),
    sanitizeFileName(sanitizeLabel(roundLabel) || ''),
    sanitizeFileName(sanitizeLabel(matchLabel) || ''),
  ]
    .filter(Boolean)
    .join('_');
 
  const shouldUseRoundRobinSelectors =
    tournamentFormat === 'roundRobin' &&
    Array.isArray(roundRobinTeamOptions) &&
    roundRobinTeamOptions.length > 0;

  const renderTeamNameControl = (value, onChange, placeholder = '', inputClassName = '') => {
    if (!shouldUseRoundRobinSelectors) {
      return (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg font-semibold ${inputClassName}`}
        />
      );
    }

    const options = [...roundRobinTeamOptions];
    if (typeof value === 'string' && value.trim().length > 0 && !options.includes(value)) {
      options.unshift(value);
    }

    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg font-semibold ${inputClassName}`}
      >
        <option value="">Select team</option>
        {options.map((option) => (
          <option key={`round-robin-option-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

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

        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-5 md:p-6 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-green-400">
                Configuration Transfer
              </h3>
              <p className="text-slate-400 text-xs md:text-sm mt-1">
                Import or export your full scoring setup, including tournament format, groups, and standings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportConfiguration}
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 via-emerald-600 to-green-500 hover:from-green-500 hover:via-emerald-500 hover:to-green-400 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-2xl hover:shadow-green-500/40 transform hover:scale-105 active:scale-95"
              >
                ⬇️ Export Setup
              </button>
              <button
                type="button"
                onClick={handleTriggerConfigImport}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-sky-600 to-blue-500 hover:from-blue-500 hover:via-sky-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-2xl hover:shadow-blue-500/40 transform hover:scale-105 active:scale-95"
              >
                ⬆️ Import Setup
              </button>
              <input
                ref={configFileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleConfigImportChange}
              />
            </div>
          </div>
          {configTransferStatus && (
            <div
              className={`mt-4 px-4 py-3 rounded-xl text-sm font-semibold ${
                configTransferStatus.type === 'success'
                  ? 'bg-green-900/40 border border-green-700 text-green-200'
                  : 'bg-red-900/40 border border-red-700 text-red-200'
              }`}
            >
              {configTransferStatus.type === 'success' ? '✅ ' : '❌ '}
              {configTransferStatus.message}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-cyan-300 to-purple-300 mb-4">
            🎯 Tournament Format
          </h3>
          <TournamentFormatSelector
            format={tournamentFormat}
            onFormatChange={handleTournamentFormatChange}
            roundRobinConfig={roundRobinConfig}
            onRoundRobinConfigChange={handleRoundRobinConfigChange}
          />
          {tournamentFormat === 'roundRobin' && (
            <div className="mt-5 rounded-xl border border-blue-500/40 bg-blue-900/20 px-4 py-3 text-slate-200 text-sm">
              <p className="font-semibold">
                {roundRobinConfig.groupCount} group
                {roundRobinConfig.groupCount === 1 ? '' : 's'} • {roundRobinConfig.teamsPerGroup} team
                {roundRobinConfig.teamsPerGroup === 1 ? '' : 's'} per group
              </p>
              <p className="text-slate-300 text-xs mt-1">
                Total slots: {roundRobinConfig.groupCount * roundRobinConfig.teamsPerGroup}
              </p>
            </div>
          )}
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

        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 mb-4">
            📦 Match Summary Storage
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            When a team secures BOOYAH, capture the current standings to keep cumulative points across matches. Standings live in this session only—every save lets you choose where to export the JSON snapshot.
          </p>

          <div className="mb-6">
            <label className="block text-slate-200 text-sm font-semibold mb-3">
              Active Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => handleActiveGroupChange(e.target.value)}
              placeholder="e.g. GroupA"
              className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all shadow-lg font-mono text-sm"
            />
            <p className="text-slate-400 text-xs mt-2">
              Standings, history, and exports are stored separately for each group. Switch groups by typing an existing name or creating a new one.
            </p>

            {currentMatchKeyLabel && (
              <p className="text-slate-500 text-xs font-mono mt-2">
                Current Key: {currentMatchKeyLabel}
              </p>
            )}

            {savedGroupNames.length > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {savedGroupNames.map((savedName) => (
                  <button
                    key={savedName}
                    type="button"
                    onClick={() => handleActiveGroupChange(savedName)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      savedName === groupName
                        ? 'bg-yellow-500/90 border-yellow-400 text-slate-900'
                        : 'bg-slate-800/70 border-slate-600 text-slate-300 hover:bg-slate-700/70'
                    }`}
                  >
                    {savedName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Round Label
              </label>
              <input
                type="text"
                value={roundLabel}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setRoundLabel(nextValue);
                  const cleanGroup = sanitizeGroupName(groupName);
                  if (cleanGroup) {
                    persistGroupData(cleanGroup, {
                      cumulativeScores,
                      matchHistory,
                      roundLabel: sanitizeLabel(nextValue, DEFAULT_ROUND_LABEL),
                      matchLabel: sanitizeLabel(matchLabel, DEFAULT_MATCH_LABEL),
                    });
                  }
                }}
                placeholder="e.g. R1"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all shadow-lg font-mono text-sm"
              />
              <p className="text-slate-400 text-xs mt-2">
                Use this to track which round these standings belong to.
              </p>
            </div>
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">
                Match Label
              </label>
              <input
                type="text"
                value={matchLabel}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setMatchLabel(nextValue);
                  const cleanGroup = sanitizeGroupName(groupName);
                  if (cleanGroup) {
                    persistGroupData(cleanGroup, {
                      cumulativeScores,
                      matchHistory,
                      roundLabel: sanitizeLabel(roundLabel, DEFAULT_ROUND_LABEL),
                      matchLabel: sanitizeLabel(nextValue, DEFAULT_MATCH_LABEL),
                    });
                  }
                }}
                placeholder="e.g. M1"
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all shadow-lg font-mono text-sm"
              />
              <p className="text-slate-400 text-xs mt-2">
                Specify the match number or name (e.g. Match 2, Finals Match 1).
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-slate-200 text-sm font-semibold mb-3">
              Import Saved Summary JSON
            </label>
            <label
              htmlFor="match-summary-upload"
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 hover:from-slate-600 hover:via-slate-500 hover:to-slate-600 text-white font-semibold rounded-xl cursor-pointer transition-all shadow-lg"
            >
              ⬆️ Upload JSON
            </label>
            <input
              id="match-summary-upload"
              type="file"
              accept="application/json,.json"
              onChange={handleJsonUpload}
              className="hidden"
            />
            <p className="text-slate-400 text-xs mt-2">
              Import a previously exported summary to continue adding results in later matches.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <button
              onClick={handleSaveMatchResults}
              disabled={
                !booyahTeam ||
                !teams.length ||
                !sanitizeGroupName(groupName) ||
                !sanitizeLabel(roundLabel) ||
                !sanitizeLabel(matchLabel)
              }
              className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-400 hover:via-orange-400 hover:to-red-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-orange-500/50 transform hover:scale-105 active:scale-95"
            >
              {booyahTeam
                ? `💾 Save ${sanitizeGroupName(groupName) || 'Group'} • ${sanitizeLabel(roundLabel) || 'Round'} • ${sanitizeLabel(matchLabel) || 'Match'}`
                : 'Waiting for BOOYAH...'}
            </button>

            <button
              type="button"
              onClick={handleNextMatch}
              className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 hover:from-slate-600 hover:via-slate-500 hover:to-slate-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-2xl hover:shadow-slate-500/40 transform hover:scale-105 active:scale-95"
            >
              ➡️ Next Match
            </button>
          </div>

          {(!sanitizeGroupName(groupName) || !sanitizeLabel(roundLabel) || !sanitizeLabel(matchLabel)) && (
            <p className="text-xs text-red-300 mt-3">
              Enter group, round, and match names to enable saving and exporting standings.
            </p>
          )}

          {matchSaveStatus && (
            <div
              className={`px-4 py-3 rounded-xl mt-4 ${
                matchSaveStatus.type === 'success'
                  ? 'bg-green-900/50 border-2 border-green-700 text-green-100'
                  : matchSaveStatus.type === 'error'
                  ? 'bg-red-900/50 border-2 border-red-700 text-red-100'
                  : matchSaveStatus.type === 'loading'
                  ? 'bg-blue-900/50 border-2 border-blue-700 text-blue-100'
                  : 'bg-slate-900/60 border-2 border-slate-700 text-slate-200'
              }`}
            >
              <p className="text-sm font-semibold">
                {matchSaveStatus.type === 'success' && '✅ '}
                {matchSaveStatus.type === 'error' && '❌ '}
                {matchSaveStatus.type === 'loading' && '⏳ '}
                {matchSaveStatus.type === 'info' && 'ℹ️ '}
                {matchSaveStatus.message}
              </p>
            </div>
          )}

          {cumulativeScoresList.length > 0 && (
            <div className="mt-6">
              <p className="text-slate-300 text-sm font-semibold mb-3">
                Cumulative Standings — {sanitizeGroupName(groupName) || 'No group selected'}
              </p>
              <div className="overflow-x-auto bg-slate-900/70 border border-slate-700 rounded-xl">
                <table className="min-w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-900/90">
                    <tr>
                      <th className="px-4 py-3">Pos</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Matches</th>
                      <th className="px-4 py-3">Booyah</th>
                      <th className="px-4 py-3">Kills</th>
                      <th className="px-4 py-3">Placement</th>
                      <th className="px-4 py-3">Prev Total</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumulativeScoresList.map((entry, index) => (
                      <tr
                        key={`${entry.teamName}-${index}`}
                        className={`border-t border-slate-800/70 ${index % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900/40'}`}
                      >
                        <td className="px-4 py-3 font-bold text-slate-100">#{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-100">{entry.teamName}</td>
                        <td className="px-4 py-3">{entry.matches}</td>
                        <td className="px-4 py-3">{entry.booyahCount}</td>
                        <td className="px-4 py-3 text-red-300">{entry.killPoints}</td>
                        <td className="px-4 py-3 text-yellow-300">{entry.placementPoints}</td>
                        <td className="px-4 py-3 text-slate-300">{entry.previousTotalPoints}</td>
                        <td className="px-4 py-3 text-green-300 font-bold">{entry.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Team Name Mapping Section */}
        <div className="bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="mb-4">
            <p className="text-slate-200 text-sm font-semibold">Team Name Mapping</p>
            <p className="text-slate-400 text-xs mt-1">
              Left column shows the team names fetched from the match. Enter your preferred display name on the right.
            </p>
          </div>
          {tournamentFormat === 'roundRobin' &&
            Array.isArray(roundRobinConfig?.groups) &&
            roundRobinConfig.groups.length > 0 && (
              <div className="mb-5">
                <p className="text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                  Active Groups For Dropdowns
                </p>
                <div className="flex flex-wrap gap-2">
                  {roundRobinConfig.groups.map((group, index) => {
                    const label =
                      typeof group?.name === 'string' && group.name.trim().length > 0
                        ? group.name.trim()
                        : `Group ${ROUND_ROBIN_ALPHABET[index] || index + 1}`;
                    const enabled = group?.enabled !== false;
                    return (
                      <label
                        key={`round-robin-group-toggle-${index}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                          enabled
                            ? 'bg-blue-500/20 border-blue-500/60 text-blue-100'
                            : 'bg-slate-800/60 border-slate-600 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => handleRoundRobinGroupToggle(index, event.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          <div className="space-y-3">
            {Array.isArray(sourceTeams) && sourceTeams.length > 0 ? (
              sourceTeams.map((team, index) => {
                const baseName = resolveTeamBaseName(team, index);
                const key = normalizeTeamNameKey(baseName);
                const overrideValue =
                  key && typeof teamNameOverrides[key] === 'string' ? teamNameOverrides[key] : '';

                return (
                  <div
                    key={`${key || 'team'}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center"
                  >
                    <div className="px-4 py-3 bg-slate-900/70 border-2 border-slate-700 rounded-xl text-slate-200 font-semibold flex items-center justify-between">
                      <span className="truncate">{baseName}</span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 ml-3">
                        Fetched
                      </span>
                    </div>
                    {renderTeamNameControl(
                      overrideValue,
                      (nextValue) => handleTeamOverrideChange(baseName, nextValue),
                      shouldUseRoundRobinSelectors ? 'Select team' : 'Custom team name (optional)'
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-slate-400 text-sm">
                Fetch match data to automatically load participating teams. You can then add or adjust
                display names here.
              </p>
            )}

            {(() => {
              const existingCount = Array.isArray(sourceTeams) ? sourceTeams.length : 0;
              const manualSlotCount = Math.max(0, 12 - existingCount);

              return Array.from({ length: manualSlotCount }, (_, i) => {
                const position = existingCount + i + 1;
                const currentValue = manualTeamSlots[position] || '';
                return (
                  <div
                    key={`manual-slot-${position}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center"
                  >
                    <div className="px-4 py-3 bg-slate-900/70 border-2 border-slate-700 rounded-xl text-slate-200 font-semibold flex items-center justify-between">
                      <span className="truncate">Team Slot {position}</span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 ml-3">
                        Manual
                      </span>
                    </div>
                    {renderTeamNameControl(
                      currentValue,
                      (nextValue) => handleManualTeamSlotChange(position, nextValue),
                      shouldUseRoundRobinSelectors ? 'Select team' : `Team ${position} name (optional)`
                    )}
                  </div>
                );
              });
            })()}
          </div>
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

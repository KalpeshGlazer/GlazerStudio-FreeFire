'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

const GROUP_NAME_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const getDefaultGroupName = (index) => {
  const letter = GROUP_NAME_ALPHABET[index] || `${index + 1}`;
  return `Group ${letter}`;
};

const TournamentFormatSelector = ({ format = 'linear', onFormatChange, roundRobinConfig, onRoundRobinConfigChange }) => {
  const safeConfig = useMemo(() => {
    const rawGroupCount =
      roundRobinConfig && typeof roundRobinConfig.groupCount !== 'undefined'
        ? Number(roundRobinConfig.groupCount)
        : 3;
    const rawTeamsPerGroup =
      roundRobinConfig && typeof roundRobinConfig.teamsPerGroup !== 'undefined'
        ? Number(roundRobinConfig.teamsPerGroup)
        : 2;

    const groupCount = Number.isFinite(rawGroupCount)
      ? Math.max(1, Math.min(rawGroupCount, GROUP_NAME_ALPHABET.length))
      : 3;
    const teamsPerGroup = Number.isFinite(rawTeamsPerGroup)
      ? Math.max(1, rawTeamsPerGroup)
      : 2;

    const groups = Array.from({ length: groupCount }, (_, index) => {
      const existingGroup =
        Array.isArray(roundRobinConfig?.groups) && roundRobinConfig.groups[index]
          ? roundRobinConfig.groups[index]
          : null;

      const existingName =
        existingGroup && typeof existingGroup.name === 'string' && existingGroup.name.trim().length > 0
          ? existingGroup.name
          : getDefaultGroupName(index);

      const teams = Array.from({ length: teamsPerGroup }, (_, teamIndex) => {
        if (existingGroup && Array.isArray(existingGroup.teams)) {
          const existingTeam = existingGroup.teams[teamIndex];
          if (existingTeam && typeof existingTeam === 'object') {
            return {
              shortName:
                typeof existingTeam.shortName === 'string'
                  ? existingTeam.shortName
                  : typeof existingTeam.name === 'string'
                  ? existingTeam.name
                  : '',
              fullName: typeof existingTeam.fullName === 'string' ? existingTeam.fullName : '',
            };
          }
          if (typeof existingTeam === 'string') {
            return {
              shortName: existingTeam,
              fullName: '',
            };
          }
        }
        return {
          shortName: '',
          fullName: '',
        };
      });

      const enabled =
        existingGroup && typeof existingGroup.enabled === 'boolean' ? existingGroup.enabled : true;

      return {
        name: existingName,
        teams,
        enabled,
      };
    });

    return {
      groupCount,
      teamsPerGroup,
      groups,
    };
  }, [roundRobinConfig]);

  const emitConfigUpdate = (nextConfig) => {
    if (typeof onRoundRobinConfigChange === 'function') {
      onRoundRobinConfigChange(nextConfig);
    }
  };

  const handleGroupCountChange = (event) => {
    const rawValue = Number(event.target.value);
    const nextCount = Number.isFinite(rawValue)
      ? Math.max(1, Math.min(rawValue, GROUP_NAME_ALPHABET.length))
      : safeConfig.groupCount;

    const groups = Array.from({ length: nextCount }, (_, index) => {
      const existingGroup = safeConfig.groups[index];
      const name =
        existingGroup && typeof existingGroup.name === 'string' && existingGroup.name.trim().length > 0
          ? existingGroup.name
          : getDefaultGroupName(index);

      const teams = Array.from({ length: safeConfig.teamsPerGroup }, (_, teamIndex) => {
        if (existingGroup && Array.isArray(existingGroup.teams)) {
          const existingTeam = existingGroup.teams[teamIndex];
          if (existingTeam && typeof existingTeam === 'object') {
            return {
              shortName:
                typeof existingTeam.shortName === 'string'
                  ? existingTeam.shortName
                  : typeof existingTeam.name === 'string'
                  ? existingTeam.name
                  : '',
              fullName: typeof existingTeam.fullName === 'string' ? existingTeam.fullName : '',
            };
          }
          if (typeof existingTeam === 'string') {
            return {
              shortName: existingTeam,
              fullName: '',
            };
          }
        }
        return {
          shortName: '',
          fullName: '',
        };
      });

      const enabled =
        existingGroup && typeof existingGroup.enabled === 'boolean' ? existingGroup.enabled : true;

      return {
        name,
        teams,
        enabled,
      };
    });

    emitConfigUpdate({
      groupCount: nextCount,
      teamsPerGroup: safeConfig.teamsPerGroup,
      groups,
    });
  };

  const handleTeamsPerGroupChange = (event) => {
    const rawValue = Number(event.target.value);
    const nextTeamsPerGroup = Number.isFinite(rawValue) ? Math.max(1, rawValue) : safeConfig.teamsPerGroup;

    const groups = safeConfig.groups.map((group) => {
      const teams = Array.from({ length: nextTeamsPerGroup }, (_, teamIndex) => {
        if (Array.isArray(group.teams)) {
          const existingTeam = group.teams[teamIndex];
          if (existingTeam && typeof existingTeam === 'object') {
            return {
              shortName:
                typeof existingTeam.shortName === 'string'
                  ? existingTeam.shortName
                  : typeof existingTeam.name === 'string'
                  ? existingTeam.name
                  : '',
              fullName: typeof existingTeam.fullName === 'string' ? existingTeam.fullName : '',
            };
          }
          if (typeof existingTeam === 'string') {
            return {
              shortName: existingTeam,
              fullName: '',
            };
          }
        }
        return {
          shortName: '',
          fullName: '',
        };
      });

      return {
        ...group,
        teams,
      };
    });

    emitConfigUpdate({
      groupCount: safeConfig.groupCount,
      teamsPerGroup: nextTeamsPerGroup,
      groups,
    });
  };

  const handleGroupEnabledToggle = (groupIndex, checked) => {
    const groups = safeConfig.groups.map((group, index) =>
      index === groupIndex
        ? {
            ...group,
            enabled: checked,
          }
        : group
    );

    emitConfigUpdate({
      groupCount: safeConfig.groupCount,
      teamsPerGroup: safeConfig.teamsPerGroup,
      groups,
    });
  };

  const handleGroupNameChange = (groupIndex, value) => {
    const groups = safeConfig.groups.map((group, index) =>
      index === groupIndex
        ? {
            ...group,
            name: value,
          }
        : group
    );

    emitConfigUpdate({
      groupCount: safeConfig.groupCount,
      teamsPerGroup: safeConfig.teamsPerGroup,
      groups,
    });
  };

  const getGroupTeamsFieldText = useCallback((group, field) => {
    if (!group || !Array.isArray(group.teams)) {
      return '';
    }
    return group.teams
      .map((team) => {
        if (team && typeof team === 'object') {
          if (field === 'shortName') {
            return team.shortName || '';
          }
          if (field === 'fullName') {
            return team.fullName || '';
          }
          return '';
        }
        if (typeof team === 'string') {
          return field === 'shortName' ? team : '';
        }
        return '';
      })
      .join('\n');
  }, []);

  const [groupTextInputs, setGroupTextInputs] = useState(() => {
    if (!Array.isArray(safeConfig.groups)) {
      return [];
    }

    return safeConfig.groups.map((group) => {
      const short = getGroupTeamsFieldText(group, 'shortName');
      const full = getGroupTeamsFieldText(group, 'fullName');
      return {
        short,
        full,
        syncedShort: short,
        syncedFull: full,
      };
    });
  });

  useEffect(() => {
    if (!Array.isArray(safeConfig.groups)) {
      if (groupTextInputs.length > 0) {
        setGroupTextInputs([]);
      }
      return;
    }

    const snapshot = safeConfig.groups.map((group) => ({
      short: getGroupTeamsFieldText(group, 'shortName'),
      full: getGroupTeamsFieldText(group, 'fullName'),
    }));

    setGroupTextInputs((prev) => {
      let changed = false;

      const next = snapshot.map((snap, index) => {
        const existing = prev[index];
        if (!existing) {
          changed = true;
          return {
            short: snap.short,
            full: snap.full,
            syncedShort: snap.short,
            syncedFull: snap.full,
          };
        }

        let short = existing.short;
        let full = existing.full;

        if (existing.short === existing.syncedShort && existing.syncedShort !== snap.short) {
          short = snap.short;
          changed = true;
        }

        if (existing.full === existing.syncedFull && existing.syncedFull !== snap.full) {
          full = snap.full;
          changed = true;
        }

        const syncedShort = snap.short;
        const syncedFull = snap.full;

        if (syncedShort !== existing.syncedShort || syncedFull !== existing.syncedFull) {
          changed = true;
        }

        return {
          short,
          full,
          syncedShort,
          syncedFull,
        };
      });

      if (next.length !== prev.length) {
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [safeConfig.groups, getGroupTeamsFieldText]);

  const handleGroupTeamListChange = (groupIndex, field, value) => {
    setGroupTextInputs((prev) => {
      const next = [...prev];
      const existing = next[groupIndex] || {
        short: '',
        full: '',
        syncedShort: '',
        syncedFull: '',
      };

      next[groupIndex] = {
        short: field === 'shortName' ? value : existing.short,
        full: field === 'fullName' ? value : existing.full,
        syncedShort: existing.syncedShort,
        syncedFull: existing.syncedFull,
      };

      return next;
    });

    const currentInput = groupTextInputs[groupIndex] || {
      short: getGroupTeamsFieldText(safeConfig.groups[groupIndex], 'shortName'),
      full: getGroupTeamsFieldText(safeConfig.groups[groupIndex], 'fullName'),
    };

    const shortSource = field === 'shortName' ? value : currentInput.short;
    const fullSource = field === 'fullName' ? value : currentInput.full;

    const parseLines = (text) =>
      text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\r/g, ''));

    const baseGroup = safeConfig.groups[groupIndex] || { teams: [] };
    const existingShort = Array.isArray(baseGroup.teams)
      ? baseGroup.teams.map((team) =>
          team && typeof team === 'object'
            ? team.shortName || ''
            : typeof team === 'string'
            ? team
            : ''
        )
      : [];
    const existingFull = Array.isArray(baseGroup.teams)
      ? baseGroup.teams.map((team) =>
          team && typeof team === 'object'
            ? team.fullName || ''
            : ''
        )
      : [];

    const updatedShort = parseLines(shortSource);
    const updatedFull = parseLines(fullSource);

    // Use the configured teamsPerGroup as the limit - don't auto-increase when typing names
    // Only use as many teams as configured, but allow input to be longer (will be truncated)
    const maxLength = safeConfig.teamsPerGroup;

    const teams = Array.from({ length: maxLength }, (_, index) => ({
      shortName: updatedShort[index] ?? '',
      fullName: updatedFull[index] ?? '',
    }));

    const groups = safeConfig.groups.map((group, index) =>
      index === groupIndex
        ? {
            ...group,
            teams,
          }
        : group
    );

    // Keep teamsPerGroup as user configured - don't auto-increase
    emitConfigUpdate({
      groupCount: safeConfig.groupCount,
      teamsPerGroup: safeConfig.teamsPerGroup,
      groups,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-200 text-sm font-semibold mb-3">Tournament Format</label>
          <select
            value={format}
            onChange={(event) => onFormatChange?.(event.target.value)}
            className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg text-sm"
          >
            <option value="linear">Linear Format</option>
            <option value="roundRobin">Round Robin Format</option>
          </select>
          <p className="text-slate-400 text-xs mt-2">
            Linear format runs through matches sequentially. Round robin splits teams into even groups.
          </p>
        </div>

        {format === 'roundRobin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">Number of Groups</label>
              <input
                type="number"
                min={1}
                max={GROUP_NAME_ALPHABET.length}
                value={safeConfig.groupCount}
                onChange={handleGroupCountChange}
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg text-sm"
              />
              <p className="text-slate-400 text-xs mt-2">Set how many groups you need. Default names auto-fill (Group A, Group B...).</p>
            </div>
            <div>
              <label className="block text-slate-200 text-sm font-semibold mb-3">Teams per Group</label>
              <input
                type="number"
                min={1}
                value={safeConfig.teamsPerGroup}
                onChange={handleTeamsPerGroupChange}
                className="w-full px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg text-sm"
              />
              <p className="text-slate-400 text-xs mt-2">We will create inputs for each team automatically.</p>
            </div>
          </div>
        )}
      </div>

      {format === 'roundRobin' && (
        <div className="space-y-4">
          {safeConfig.groups.map((group, groupIndex) => {
            const inputState =
              groupTextInputs[groupIndex] ||
              (function deriveFallback() {
                const short = getGroupTeamsFieldText(group, 'shortName');
                const full = getGroupTeamsFieldText(group, 'fullName');
                return {
                  short,
                  full,
                  syncedShort: short,
                  syncedFull: full,
                };
              })();

            const shortNamesText = inputState.short;
            const fullNamesText = inputState.full;
            const shortNameCount = shortNamesText
              .split(/\r?\n/)
              .map((line) => line.replace(/\r/g, ''))
              .filter((line) => line.trim()).length;
            const fullNameCount = fullNamesText
              .split(/\r?\n/)
              .map((line) => line.replace(/\r/g, ''))
              .filter((line) => line.trim()).length;
            const pairedEntriesCount = Array.isArray(group.teams)
              ? group.teams.filter((team) => {
                  if (!team || typeof team !== 'object') {
                    return false;
                  }
                  const shortName =
                    typeof team.shortName === 'string' ? team.shortName.trim() : '';
                  const fullName =
                    typeof team.fullName === 'string' ? team.fullName.trim() : '';
                  return Boolean(shortName || fullName);
                }).length
              : 0;

            return (
              <div
                key={`round-robin-group-${groupIndex}`}
                className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/60 shadow-inner space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-slate-200 text-xs font-semibold">
                      Group Name
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={group.enabled !== false}
                        onChange={(event) => handleGroupEnabledToggle(groupIndex, event.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                      />
                      Active
                    </label>
                  </div>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(event) => handleGroupNameChange(groupIndex, event.target.value)}
                    placeholder={getDefaultGroupName(groupIndex)}
                    className="w-full px-4 py-2.5 bg-slate-950/70 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-200 text-sm font-semibold mb-2">
                      Team names (short)
                    </label>
                    <textarea
                      value={shortNamesText}
                      onChange={(event) => handleGroupTeamListChange(groupIndex, 'shortName', event.target.value)}
                      placeholder={`Team 1\nTeam 2\nTeam 3\nTeam 4`}
                      className="w-full h-40 px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg font-semibold resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-200 text-sm font-semibold mb-2">
                      Full team names
                    </label>
                    <textarea
                      value={fullNamesText}
                      onChange={(event) => handleGroupTeamListChange(groupIndex, 'fullName', event.target.value)}
                      placeholder={`Team ABC 1\nTeam DHDH\nTeam DJJD\nTeam DJHHDJ`}
                      className="w-full h-40 px-5 py-3 bg-slate-900/80 text-white rounded-xl border-2 border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-lg font-semibold resize-none"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">
                  <span>Short names: {shortNameCount} • Full names: {fullNameCount}</span>
                  <span className="text-slate-300">Paired entries: {pairedEntriesCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentFormatSelector;


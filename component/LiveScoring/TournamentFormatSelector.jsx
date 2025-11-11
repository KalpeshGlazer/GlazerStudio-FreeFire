'use client';

import React, { useMemo } from 'react';

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
          if (typeof existingTeam === 'string') {
            return existingTeam;
          }
        }
        return '';
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
          if (typeof existingTeam === 'string') {
            return existingTeam;
          }
        }
        return '';
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
          if (typeof existingTeam === 'string') {
            return existingTeam;
          }
        }
        return '';
      });

      return {
        ...group,
        teams,
      };
    });
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


    emitConfigUpdate({
      groupCount: safeConfig.groupCount,
      teamsPerGroup: nextTeamsPerGroup,
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

  const handleTeamNameChange = (groupIndex, teamIndex, value) => {
    const groups = safeConfig.groups.map((group, index) => {
      if (index !== groupIndex) {
        return group;
      }

      const teams = group.teams.map((team, innerIndex) => (innerIndex === teamIndex ? value : team));

      return {
        ...group,
        teams,
      };
    });

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
          {safeConfig.groups.map((group, groupIndex) => (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.teams.map((teamName, teamIndex) => (
                  <div key={`round-robin-group-${groupIndex}-team-${teamIndex}`}>
                    <label className="block text-slate-400 text-xs font-semibold mb-1">
                      Team {teamIndex + 1}
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(event) => handleTeamNameChange(groupIndex, teamIndex, event.target.value)}
                      placeholder={`Team ${teamIndex + 1}`}
                      className="w-full px-4 py-2.5 bg-slate-950/70 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentFormatSelector;


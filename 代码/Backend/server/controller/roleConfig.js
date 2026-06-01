/**
 * Role assignment overrides used when a game starts.
 * Positions are 1-based seat numbers.
 */

function getRoleConfig(roomId, playerCount) {
  const configs = {
    '6': [
      { position: 1, role: 'predictor' },
      { position: 2, role: 'wolf' },
      { position: 3, role: 'wolf' },
      { position: 6, role: 'witch' }
    ],
    '9': [
      { position: 8, role: 'wolf' }
    ],
    '12': [
      { position: 1, role: 'wolf' },
      { position: 2, role: 'wolf' },
      { position: 3, role: 'wolf' },
      { position: 4, role: 'predictor' },
      { position: 5, role: 'witch' },
      { position: 6, role: 'hunter' },
      { position: 7, role: 'wolf' },
      { position: 8, role: 'villager' }
    ]
  }

  return configs[String(playerCount)] || null
}

function validateRoleConfig(roleAssignments, standardRoleArray, playerCount) {
  if (!Array.isArray(roleAssignments)) {
    return { isValid: false, message: 'role config must be an array' }
  }

  const usedPositions = new Set()
  const usedRoles = {}

  for (const assignment of roleAssignments) {
    const { position, role } = assignment

    if (position < 1 || position > playerCount) {
      return { isValid: false, message: `position ${position} must be between 1 and ${playerCount}` }
    }

    if (usedPositions.has(position)) {
      return { isValid: false, message: `position ${position} is configured more than once` }
    }

    if (!standardRoleArray.includes(role)) {
      return { isValid: false, message: `role ${role} is not in standard config` }
    }

    usedPositions.add(position)
    usedRoles[role] = (usedRoles[role] || 0) + 1
  }

  const standardRoleCounts = {}
  for (const role of standardRoleArray) {
    standardRoleCounts[role] = (standardRoleCounts[role] || 0) + 1
  }

  for (const [role, count] of Object.entries(usedRoles)) {
    if (count > (standardRoleCounts[role] || 0)) {
      return {
        isValid: false,
        message: `role ${role} count ${count} exceeds standard count ${standardRoleCounts[role] || 0}`
      }
    }
  }

  return { isValid: true, message: 'role config validated' }
}

module.exports = {
  getRoleConfig,
  validateRoleConfig
}

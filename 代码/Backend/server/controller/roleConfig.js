/**
 * 身份配置文件
 * 用于在游戏开始时指定特定玩家的角色
 * 测试完成后可以直接删除此文件
 */

/**
 * 获取身份配置
 * @param {string} roomId - 房间ID
 * @param {number} playerCount - 玩家数量
 * @returns {Array|null} 身份配置数组或null
 */
function getRoleConfig(roomId, playerCount) {
  // 示例配置：指定特定位置的玩家角色
  const exampleConfigs = {
    // 9人局配置示例
    '9': [
      { position: 9, role: 'hunter' }     // 9号位是猎人（AI）
    ],
    
    // 6人局配置示例（保留备用）
    '6': [
      { position: 6, role: 'witch' }       // 6号位是女巫（AI）
    ],
    
    // 12人局配置示例（保留备用）
    '12': [
      { position: 1, role: 'wolf' },      // 1号位是狼人
      { position: 3, role: 'predictor' }, // 3号位是预言家
      { position: 5, role: 'witch' },     // 5号位是女巫
      { position: 7, role: 'hunter' }    // 7号位是猎人
    ],
    
    // 12人局配置示例（保留备用）
    '12': [
      { position: 1, role: 'wolf' },      // 1号位是狼人
      { position: 2, role: 'wolf' },      // 2号位是狼人
      { position: 3, role: 'wolf' },      // 3号位是狼人
      { position: 4, role: 'predictor' }, // 4号位是预言家
      { position: 5, role: 'witch' },     // 5号位是女巫
      { position: 6, role: 'hunter' },     // 6号位是猎人
      { position: 7, role: 'wolf' },      // 7号位是狼人
      { position: 8, role: 'villager' }   // 8号位是村民
    ]
  }
  
  // 返回对应人数的配置，如果没有则返回null（使用随机分配）
  return exampleConfigs[playerCount.toString()] || null
}

/**
 * 验证身份配置是否有效
 * @param {Array} roleAssignments - 身份配置数组
 * @param {Array} standardRoleArray - 标准角色配置数组
 * @param {number} playerCount - 玩家数量
 * @returns {Object} 验证结果 {isValid: boolean, message: string}
 */
function validateRoleConfig(roleAssignments, standardRoleArray, playerCount) {
  if (!Array.isArray(roleAssignments)) {
    return { isValid: false, message: '身份配置必须是数组格式' }
  }
  
  let usedPositions = new Set()
  let usedRoles = {}
  
  for (let assignment of roleAssignments) {
    let { position, role } = assignment
    
    // 检查位置是否有效
    if (position < 1 || position > playerCount) {
      return { isValid: false, message: `位置${position}无效，必须在1-${playerCount}之间` }
    }
    
    // 检查位置是否重复
    if (usedPositions.has(position)) {
      return { isValid: false, message: `位置${position}重复配置` }
    }
    
    // 检查角色是否在标准配置中
    if (!standardRoleArray.includes(role)) {
      return { isValid: false, message: `角色${role}不在标准配置中` }
    }
    
    usedPositions.add(position)
    usedRoles[role] = (usedRoles[role] || 0) + 1
  }
  
  // 验证角色数量是否超出标准配置
  let roleCountInStandard = {}
  for (let role of standardRoleArray) {
    roleCountInStandard[role] = (roleCountInStandard[role] || 0) + 1
  }
  
  for (let [role, count] of Object.entries(usedRoles)) {
    if (count > (roleCountInStandard[role] || 0)) {
      return { 
        isValid: false, 
        message: `角色${role}配置数量(${count})超出标准配置(${roleCountInStandard[role] || 0})` 
      }
    }
  }
  
  return { isValid: true, message: '身份配置验证通过' }
}

module.exports = {
  getRoleConfig,
  validateRoleConfig
}

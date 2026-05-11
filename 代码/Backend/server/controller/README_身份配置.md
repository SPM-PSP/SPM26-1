# 身份配置功能使用说明

## 概述
这个功能允许你在游戏开始时指定特定位置玩家的角色，测试完成后可以直接删除相关文件。

## 文件说明
- `roleConfig.js` - 身份配置文件（测试完成后可删除）
- `gameController.js` - 已集成身份配置读取逻辑
- `README_身份配置.md` - 本说明文档（测试完成后可删除）

## 使用方法

### 1. 编辑身份配置
打开 `roleConfig.js` 文件，修改 `exampleConfigs` 对象中的配置：

```javascript
const exampleConfigs = {
  // 9人局配置示例
  '9': [
    { position: 1, role: 'wolf' },      // 1号位是狼人
    { position: 3, role: 'predictor' }, // 3号位是预言家
    { position: 5, role: 'witch' },     // 5号位是女巫
    { position: 7, role: 'hunter' }    // 7号位是猎人
  ],
  
  // 12人局配置示例
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
```

### 2. 支持的角色类型
- `wolf` - 狼人
- `predictor` - 预言家
- `witch` - 女巫
- `hunter` - 猎人
- `villager` - 村民

### 3. 配置规则
- `position`: 位置编号，从1开始，最大值为玩家数量
- `role`: 角色名称，必须在标准配置中存在
- 不能重复配置同一位置
- 每个角色的配置数量不能超过标准配置中的数量
- 未配置的位置将随机分配剩余角色

### 4. 运行游戏
正常启动游戏服务器，开始游戏时会自动读取身份配置：

```bash
npm run server
```

### 5. 查看效果
游戏开始时，控制台会显示：
- 是否使用了身份配置
- 具体的配置信息
- 验证结果
- 最终的角色分配结果

## 示例输出
```
🎯 使用身份配置文件分配角色
📋 配置信息: [
  { "position": 1, "role": "wolf" },
  { "position": 3, "role": "predictor" }
]
✅ 身份配置验证通过

🎮 最终角色分配结果:
🐺 玩家1(username1) - wolf (真人)
👤 玩家2(username2) - villager (AI)
🔮 玩家3(username3) - predictor (真人)
...
=====================================
```

## 清理方法
测试完成后，删除以下文件即可恢复原始功能：
1. `roleConfig.js`
2. `README_身份配置.md`

然后删除 `gameController.js` 中的这行代码：
```javascript
const { getRoleConfig, validateRoleConfig } = require('./roleConfig')
```

并恢复原来的随机分配逻辑。

## 注意事项
- 身份配置是基于位置的，不是基于用户名
- 配置验证失败时会自动回退到随机分配
- 确保配置的角色数量符合游戏模式要求
- AI玩家和真人玩家都可以被配置特定角色

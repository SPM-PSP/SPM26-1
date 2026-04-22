module.exports = app => {
  const saveUser = async (ctx, userData) => {
    const {  $service, $helper, $model } = app
    const { user } = $model
    const { username, name, password, role } = userData
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return false
    }
    if(!name || name === ''){
      ctx.body = $helper.Result.fail(-1,'name不能为空！')
      return false
    }
    if(!password || password === ''){
      ctx.body = $helper.Result.fail(-1,'password不能为空！')
      return false
    }
    if(!role || role === ''){
      ctx.body = $helper.Result.fail(-1,'role不能为空！')
      return false
    }

    let existUser = await $service.baseService.queryOne(user, {username: username})
    if(existUser){
      ctx.body = $helper.Result.fail('-1', '当前用户已存在！')
      return false
    }

    let pass = await $helper.createPassword(password)
    let obj = {
      username: username,
      name: name,
      defaultRole: role,
      defaultRoleName: '',
      password: pass,
      roles: [role]
    }
    let r = await $service.baseService.save(user, obj)
    if(r){
      ctx.body = $helper.Result.success(r)
      return true
    }
    ctx.body = $helper.Result.fail(-1, '创建用户失败！')
    return false
  }

  return ({

  /**
   * @api {post} /api/user/create/auth 创建用户
   * @apiName createUser
   * @apiGroup 用户模块
   * @apiDescription 需要登录token
   * @apiParam {String} username 用户名
   * @apiParam {String} password 密码
   * @apiSuccess {Number} code 200=成功
   */
  
  async createUser(ctx) {
    //todo: url权限要跟上,
    const { username, name, password, role } = ctx.request.body
    await saveUser(ctx, { username, name, password, role })
  },

  /**
   * @api {post} /api/register 用户注册
   * @apiName register
   * @apiGroup 用户模块
   * @apiDescription 公开接口，默认创建普通玩家账号
   */
  async register(ctx) {
    const { username, name, password } = ctx.request.body
    await saveUser(ctx, {
      username,
      name,
      password,
      role: 'player'
    })
  },


  /**
   * @api {get} /api/user/getUserInfo/auth 获取用户信息
   * @apiName getUserInfo
   * @apiGroup 用户模块
   * @apiDescription 需要登录token
   * @apiSuccess {Number} code 200=成功
   * @apiSuccess {Object} data 用户信息
   */

  async getUserInfo (ctx) {
    const { $service, $helper } = app
    const token = ctx.header.authorization
    let user;
    try {
      user = await $helper.decodeToken(token)
    } catch (e) {
      $helper.Result.fail(-1,e)
    }
    if(!user){
      $helper.Result.fail(-1, '用户信息不存在')
    }
    let realUser = await $service.userService.getUserInfoById(user._id)
    ctx.userInfo = realUser
    ctx.body = $helper.Result.success(realUser)
  }
  })
}

module.exports = app => ({

  /**
   * @api {post} /api/login 用户登录
   * @apiName Login
   * @apiGroup 认证模块
   * @apiDescription 用户登录接口，不需要token
   *
   * @apiParam {String} username 用户名
   * @apiParam {String} password 密码
   *
   * @apiSuccess {Number} code 200=成功
   * @apiSuccess {String} msg 提示信息
   * @apiSuccess {String} token 登录凭证
   * @apiSuccess {Object} userInfo 用户信息
   */
  async login (ctx) {
    const { $helper, $service } = app;
    const { username, password } = ctx.request.body

    if(!username || username === '') {
      ctx.body = $helper.Result.fail(-1, '用户名不能为空！')
      return
    }

    if(!password || password === '') {
      ctx.body = $helper.Result.fail(-1, '密码不能为空！')
      return
    }

    let user = await $service.userService.getUsersByUsername(username)
    if(!user) {
      // 未查询到账户信息
      ctx.body = $helper.Result.error('USER_NOT_EXIST_ERROR')
      return
    }

    // 校验密码
    const userCurrentPass = await $service.userService.getUsersPasswordByUsername(username);
    const verifyResult = await $helper.checkPassword(password, userCurrentPass.password)

    if(!verifyResult){
      ctx.body = $helper.Result.error('PASSWORD_WRONG_ERROR')
      return;
    }

    let userDataStr = JSON.parse(JSON.stringify(user));
    let token = await $helper.createToken(userDataStr);
    ctx.body = $helper.Result.success(
      {
        accessToken: token,
        user: user
      }
    )
  },

  /**
   * 登出
   * @returns {Promise<void>}
   */
  async logout () {
    // 服务端是无状态的，登出由客户端处理即可
    const { ctx } = app;
    ctx.body = 'ok'
  }
})
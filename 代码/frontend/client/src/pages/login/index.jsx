import React from "react";
import {Form, Input, Button, Checkbox, Modal, message} from 'antd';
import {LockTwoTone, UserOutlined} from '@ant-design/icons';
import {Redirect} from "react-router-dom";
import io from '@api/login'
import bg from '@assets/images/login_bg.png'
import logo from '@assets/images/logo.svg'
import DocumentTitle from "react-document-title";
import './index.styl'
import {inject, observer} from "mobx-react";

const Login = (props) => {

  const {token, setToken, setUser}  = props.appStore
  const { history } = props
  const [registerVisible, setRegisterVisible] = React.useState(false)
  const [registerLoading, setRegisterLoading] = React.useState(false)
  const [registerForm] = Form.useForm()

  const handleUserInfo = (data) => {
    setUser(data.user)
    setToken(data.accessToken)
    history.replace('/')
  }

  const onFinish = async (values) => {
    try {
      const data = await io.login({
        username: values.username,
        password: values.password,
      })
      message.success('登录成功！')
      handleUserInfo(data)
    } catch (e) {
    }
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  const onRegister = async () => {
    try {
      const values = await registerForm.validateFields()
      setRegisterLoading(true)
      await io.register({
        username: values.username,
        name: values.name,
        password: values.password,
      })
      message.success('注册成功，请直接登录')
      registerForm.resetFields()
      setRegisterVisible(false)
    } catch (e) {
    } finally {
      setRegisterLoading(false)
    }
  }

  // 如果已经登录，直接跳转到首页
  if (token) {
    return <Redirect to="/" />;
  }

  return (
    <DocumentTitle title="用户登录">
      <div className="login-container FBV FBAC" style={{background: `url(${bg}) no-repeat 100%`, backgroundSize: '100% 100%'}}>
        <div className="login-title-container mar-b40">
          <div className="logo-wrap">
            <img src={logo} alt="" />
          </div>
          <div className="desc-wrap mar-t10">lrs登录</div>
        </div>
        <div className="form-container mar-t40">
          <Form
            name="basic"
            initialValues={{remember: true}}
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
            >
              <Input
                placeholder="用户名"
                prefix={(
                  <UserOutlined style={{color: '#1890ff'}} />
                )}
              />
            </Form.Item>

            <Form.Item
              name="password"
            >
              <Input.Password
                placeholder="请输入用"
                prefix={(
                  <LockTwoTone style={{color: '#1890ff'}} />
                )}
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked">
              <Checkbox>自动登录</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" className="submit-button">
                登录
              </Button>
            </Form.Item>
            <Form.Item>
              <Button
                className="submit-button register-button"
                onClick={() => {
                  setRegisterVisible(true)
                }}
              >
                注册账号
              </Button>
            </Form.Item>
          </Form>
        </div>
        <Modal
          title="注册账号"
          visible={registerVisible}
          onOk={onRegister}
          onCancel={() => {
            setRegisterVisible(false)
          }}
          okText="注册"
          cancelText="取消"
          confirmLoading={registerLoading}
          destroyOnClose
        >
          <Form form={registerForm} layout="vertical" preserve={false}>
            <Form.Item
              name="username"
              label="账号"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input placeholder="请输入登录账号" />
            </Form.Item>
            <Form.Item
              name="name"
              label="游戏昵称"
              rules={[{ required: true, message: '请输入游戏昵称' }]}
            >
              <Input placeholder="请输入游戏昵称" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </DocumentTitle>
  )
}

export default inject('appStore')(observer(Login))

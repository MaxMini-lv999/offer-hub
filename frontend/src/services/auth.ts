import { get, post } from '@/lib/request'
import type { LogoutData, PasswordAuthUserDTO, PasswordLoginData, UserInfo, UserProfile } from '@/types/auth'

// code 非 0 时 get / post 会抛出 ApiError（继承 Error，message 是后端的 msg），这里不用再判断

/** POST /auth/register 注册，成功时 data 为 null */
export function postAuthRegister(username: string, password: string) {
  return post<null>('/auth/register', { username, password })
}

/** POST /auth/login 登录，返回 token 和 camelCase 的 userInfo */
export function postAuthLogin(username: string, password: string) {
  return post<PasswordLoginData>('/auth/login', { username, password })
}

/** POST /auth/logout 登出，Authorization 由 axios 请求拦截器自动带上 */
export function postAuthLogout() {
  return post<LogoutData>('/auth/logout')
}

/** GET /api/v1/user_info/get_user_info 获取当前登录用户的信息 */
export function getUserInfo() {
  return get<UserProfile>('/api/v1/user_info/get_user_info')
}

/** 登录响应的 camelCase userInfo 转成 snake_case，与用户信息接口保持一致后存入 Context */
export function mapPasswordAuthUserToUserInfo(user: PasswordAuthUserDTO): UserInfo {
  return {
    user_id: user.userId,
    username: user.username,
    nick_name: user.nickName,
    avatar: user.avatar,
    sex: user.sex,
    vip: user.vip,
    phone: user.phone,
    email: user.email,
    user_status: user.userStatus,
    user_type: user.userType,
  }
}

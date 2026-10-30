/** 性别：1未知 / 2男 / 3女 */
export type Sex = 1 | 2 | 3

/** 用户状态：1正常 / -1禁用 */
export type UserStatus = 1 | -1

/** 用户类型：1普通用户 / 2内测用户 */
export type UserType = 1 | 2

/** 登录响应里的用户信息，后端这里用 camelCase，与其他接口的 snake_case 不同 */
export interface PasswordAuthUserDTO {
  userId: string
  username: string
  nickName: string
  avatar: string
  sex: Sex
  vip: boolean
  phone: string
  email: string
  userStatus: UserStatus
  userType: UserType
}

/** POST /auth/login 响应 data */
export interface PasswordLoginData {
  token: string
  userInfo: PasswordAuthUserDTO
}

/** POST /auth/logout 响应 data */
export interface LogoutData {
  message: string
}

/** 存入 Context 的用户信息，snake_case，字段是登录响应和用户信息接口共有的部分 */
export interface UserInfo {
  user_id: string
  username: string
  nick_name: string
  avatar: string
  sex: Sex
  vip: boolean
  phone: string
  email: string
  user_status: UserStatus
  user_type: UserType
}

/** GET /api/v1/user_info/get_user_info 响应 data，比登录响应多出简介和时间 */
export interface UserProfile extends UserInfo {
  introduction: string
  /** 与 avatar 取值相同 */
  avatar_url: string
  /** 格式 2024-01-01 12:00:00 */
  create_time: string
  update_time: string
}

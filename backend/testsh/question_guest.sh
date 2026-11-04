#!/usr/bin/env bash
# 题库 / 题目接口回归测试（游客视角）
#
# 覆盖 router.go 里当前注册的全部题目接口（都是 GET）：
#   /api/v1/question/all/list   /api/v1/question/list   /api/v1/question/meta/list
#   /api/v1/question/detail     /api/v1/question/hot/list
#   /api/v1/question/random/list  /api/v1/question/tag/list
#
# 依赖：bash 4+、curl、python3（只用标准库解析 JSON，不需要 jq）
#
# 前置：
#   1. 已写入 backend/testdata 的种子数据：cd backend/testdata && npm run seed
#      描述里带「种子」的断言按那份数据写死了期望值，改了种子要同步改这里；其余断言只检查接口规则，与具体数据无关
#   2. 后端已启动：cd backend/src && go run .
#
# 用法：
#   bash backend/testsh/question_guest.sh
#   BASE_URL=http://127.0.0.1:18180 bash backend/testsh/question_guest.sh
#
# 环境变量：
#   BASE_URL   后端地址，默认 http://127.0.0.1:8180（config-test.toml 的 port）
#   TIMEOUT    单个请求的超时秒数，默认 5
#   VERBOSE=1  断言失败时额外打印完整响应体
#   NO_COLOR=1 关闭颜色（输出不是终端时也会自动关闭）
#
# 退出码：0 全部通过；1 有断言失败；2 环境问题（缺依赖、连不上后端）
#
# 游客 / 登录场景的拆分：
#   本脚本只测游客：所有请求都不带 token，覆盖题目查询接口（软鉴权）的游客分支——
#   列表和详情的 content 截断到 150 字、详情的 analysis_content 为空串、user_tag / user_liked 为零值、
#   user_tag 过滤参数被忽略（不在 0~3 的值仍然返回参数错误）。
#   鉴权模块完成后，复制本文件为 question_user.sh，按下面改：
#     1. 预检之后先 POST /api/v1/auth/login 拿到 token（或从环境变量 TOKEN 传入），
#        在 request() 的 curl 参数里加上 -H "Authorization: Bearer $TOKEN"
#     2. 模仿 request() 写一个 post_json()（curl -X POST -H 'Content-Type: application/json' --data "$json"）
#     3. 把游客断言换成登录断言：content 不截断、user_tag / user_liked 是真实值、user_tag 过滤生效
#     4. 新增强制鉴权接口 POST /api/v1/safe/tag_question：不带 token 返回 code=401；
#        标记后详情里的 user_tag 跟着变；tag=0 取消标记
#   到那时两个脚本的「公共函数」一节会完全重复，把它抽成 backend/testsh/lib.sh，两边 source 即可。

set -euo pipefail

BASE_URL=${BASE_URL:-http://127.0.0.1:8180}
BASE_URL=${BASE_URL%/}
TIMEOUT=${TIMEOUT:-5}
API=/api/v1/question

# ==================== 公共函数 ====================

if [[ -t 1 && -z ${NO_COLOR:-} ]]; then
  GREEN=$'\e[32m' RED=$'\e[31m' YELLOW=$'\e[33m' BOLD=$'\e[1m' DIM=$'\e[2m' RESET=$'\e[0m'
else
  GREEN='' RED='' YELLOW='' BOLD='' DIM='' RESET=''
fi

PASS_COUNT=0 FAIL_COUNT=0 SKIP_COUNT=0
FAILED=()
CUR_STEP=''
CUR=''         # 最近一次响应体的文件路径
HTTP_STATUS='' # 最近一次响应的 HTTP 状态码

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
trap 'echo "${RED}脚本在第 $LINENO 行意外退出${RESET}" >&2' ERR

step() {
  CUR_STEP=$1
  printf '\n%s▶ %s%s\n' "$BOLD" "$1" "$RESET"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '  %s[PASS]%s %s\n' "$GREEN" "$RESET" "$1"
}

# fail 描述 [详情]
fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED+=("$CUR_STEP：$1")
  printf '  %s[FAIL]%s %s\n' "$RED" "$RESET" "$1"
  if [[ -n ${2:-} ]]; then
    printf '         %s\n' "$2"
  fi
  if [[ -n ${VERBOSE:-} && -f $CUR ]]; then
    printf '         响应：%s\n' "$(head -c 2000 "$CUR")"
  fi
}

# skip 描述：接口文档要求了、但代码还没实现的点，不计入失败
skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  printf '  %s[SKIP]%s %s\n' "$YELLOW" "$RESET" "$1"
}

# request 名字 路径 [参数=值 ...]
# 发 GET 请求，参数自动 URL 编码（同名参数可以写多次，比如 tags=Go tags=并发）。
# 响应体存到 $TMP_DIR/名字.json，之后的断言可以用 R("名字") 取回；QUIET=1 时不打印请求行
request() {
  local name=$1 path=$2
  shift 2
  local args=() kv
  for kv in "$@"; do
    args+=(--data-urlencode "$kv")
  done
  CUR="$TMP_DIR/$name.json"
  HTTP_STATUS=$(curl -sS -G -o "$CUR" -w '%{http_code}' --max-time "$TIMEOUT" \
    ${args[@]+"${args[@]}"} "$BASE_URL$path" 2>/dev/null) || HTTP_STATUS=000
  if [[ -z ${QUIET:-} ]]; then
    local qs
    qs=$(IFS='&'; echo "$*")
    printf '  %sGET %s%s%s\n' "$DIM" "$path" "${qs:+?$qs}" "$RESET"
  fi
}

# py 表达式：在最近一次响应上求一个 Python 表达式，字符串原样输出，其余转成 JSON 输出。
# 表达式里可用：
#   d 最近一次响应   L 最近一次响应的 data.list   R("名字") 之前保存的响应   E 环境变量
#   ids(列表) 取 question_id   by_id("名字") 把保存的列表响应转成 {question_id: 题目}
#   asc(序列) / desc(序列) 是否非降序 / 非升序   re 正则模块
#   QUESTION_FIELDS / META_FIELDS / HOT_FIELDS 各接口单条数据应有的字段
# 表达式出错时输出 "!错误信息" 并返回 1
py() {
  python3 - "$TMP_DIR" "$CUR" "$1" <<'PY'
import json, os, re, sys

tmp, cur, expr = sys.argv[1:4]

QUESTION_FIELDS = {
    "question_id", "bank_list", "title", "content", "difficulty", "tags", "status", "vip",
    "hot_degree", "view_count", "thumbs_up_count", "dislike_count", "order",
    "user_tag", "user_liked", "create_time", "update_time",
}
META_FIELDS = {"question_id", "title"}
HOT_FIELDS = {"question_id", "bank_list", "title", "view_count"}

def R(name):
    with open(os.path.join(tmp, name + ".json"), encoding="utf-8") as f:
        return json.load(f)

def ids(lst):
    return [q["question_id"] for q in lst]

def by_id(name):
    return {q["question_id"]: q for q in R(name)["data"]["list"]}

def asc(xs):
    return all(a <= b for a, b in zip(xs, xs[1:]))

def desc(xs):
    return all(a >= b for a, b in zip(xs, xs[1:]))

try:
    with open(cur, encoding="utf-8") as f:
        d = json.load(f)
    data = d.get("data") if isinstance(d, dict) else None
    L = data.get("list") if isinstance(data, dict) else None
    r = eval(expr, {
        "d": d, "L": L, "R": R, "E": os.environ, "re": re,
        "ids": ids, "by_id": by_id, "asc": asc, "desc": desc,
        "QUESTION_FIELDS": QUESTION_FIELDS, "META_FIELDS": META_FIELDS, "HOT_FIELDS": HOT_FIELDS,
    })
except Exception as e:
    print(f"!{type(e).__name__}: {e}")
    sys.exit(1)
print(r if isinstance(r, str) else json.dumps(r, ensure_ascii=False))
PY
}

# check 描述 断言表达式 [失败时要打印的表达式]
check() {
  local result
  result=$(py "bool($2)") || true
  if [[ $result == true ]]; then
    pass "$1"
  elif [[ $result == !* ]]; then
    fail "$1" "表达式出错 $result"
  elif [[ -n ${3:-} ]]; then
    fail "$1" "实际：$(py "$3" || true)"
  else
    fail "$1" "不成立：$2"
  fi
}

# expect_resp HTTP状态码 code msg 是否data为null(null|data)
expect_resp() {
  local want="$1|$2|$3|$4" got
  got=$(py '"%s|%s|%s" % (d.get("code"), d.get("msg"), "null" if d.get("data") is None else "data")') ||
    got="响应不是 JSON"
  got="$HTTP_STATUS|$got"
  if [[ $got == "$want" ]]; then
    pass "HTTP $1，code=$2，msg=$3"
  else
    fail "HTTP $1，code=$2，msg=$3" "实际：$got（HTTP|code|msg|data）"
  fi
}

# expect_ok：成功响应
expect_ok() {
  expect_resp 200 0 success data
}

# expect_err code msg：失败响应。按规范只有 code=500 时 HTTP 是 500，其余都是 200；data 为 null
expect_err() {
  local http=200
  if [[ $1 == 500 ]]; then
    http=500
  fi
  expect_resp "$http" "$1" "$2" null
}

# ==================== 预检 ====================

for cmd in curl python3; do
  if ! command -v "$cmd" >/dev/null; then
    echo "缺少依赖：$cmd" >&2
    exit 2
  fi
done
if ! curl -sS -o /dev/null --max-time "$TIMEOUT" "$BASE_URL$API/hot/list" 2>/dev/null; then
  echo "连不上 $BASE_URL，请先启动后端（cd backend/src && go run .），或用 BASE_URL 指定地址" >&2
  exit 2
fi
printf '%s题目接口回归（游客）%s  BASE_URL=%s\n' "$BOLD" "$RESET" "$BASE_URL"

# ==================== 1. 题库全量列表 /all/list ====================

step '1.1 题库全量列表：不带参数'
request all_list "$API/all/list"
expect_ok
check 'data 是非空数组，每个分组都有 job_name 和 series_list 数组' \
  'isinstance(d["data"], list) and len(d["data"]) > 0 and all(isinstance(g["job_name"], str) and isinstance(g["series_list"], list) for g in d["data"])'
check '每个系列的 bank_list 都是数组（空系列是 [] 而不是 null）' \
  'all(isinstance(s["bank_list"], list) for g in d["data"] for s in g["series_list"])'
check '每个题库的 count 都是非负整数' \
  'all(isinstance(b["count"], int) and b["count"] >= 0 for g in d["data"] for s in g["series_list"] for b in s["bank_list"])'
check '系列在各自方向内、题库在各自系列内按 order 升序' \
  'all(asc([s["order"] for s in g["series_list"]]) and all(asc([b["order"] for b in s["bank_list"]]) for s in g["series_list"]) for g in d["data"])'
check '种子：三个方向依次是 后端开发 / 前端开发 / AI开发' \
  '[g["job_name"] for g in d["data"]] == ["后端开发", "前端开发", "AI开发"]' '[g["job_name"] for g in d["data"]]'
check '种子：b001 MySQL题库 count=6（不含已删除的 q111），b004 空题库 count=0' \
  '(m := {b["bank_id"]: b["count"] for g in d["data"] for s in g["series_list"] for b in s["bank_list"]}) and m.get("b001") == 6 and m.get("b004") == 0'
check '种子：s006 前端工程化是空系列，bank_list 为 []' \
  '[s["bank_list"] for g in d["data"] for s in g["series_list"] if s["series_id"] == "s006"] == [[]]'

step '1.2 题库全量列表：job_name=前端开发'
request all_list_fe "$API/all/list" job_name=前端开发
expect_ok
check '只返回前端开发一个分组' '[g["job_name"] for g in d["data"]] == ["前端开发"]' '[g["job_name"] for g in d["data"]]'

step '1.3 题库全量列表：不存在的 job_name'
request all_list_none "$API/all/list" job_name=不存在的方向
expect_ok
check 'data 是 [] 而不是 null' 'd["data"] == []' 'd["data"]'

step '1.4 每个题库的 count 与 /list?bank_id= 的 total 一致'
CUR="$TMP_DIR/all_list.json"
bank_counts=$(py '" ".join("%s:%s" % (b["bank_id"], b["count"]) for g in d["data"] for s in g["series_list"] for b in s["bank_list"])') ||
  bank_counts=''
mismatch=()
if [[ -z $bank_counts ]]; then
  mismatch+=('没能从 /all/list 取到题库')
fi
for pair in $bank_counts; do
  bank=${pair%%:*} count=${pair##*:}
  QUIET=1 request bank_total "$API/list" bank_id="$bank" page_size=1
  total=$(py 'd["data"]["total"]') || total='?'
  if [[ $total != "$count" ]]; then
    mismatch+=("$bank count=$count total=$total")
  fi
done
if ((${#mismatch[@]} == 0)); then
  pass "$(wc -w <<<"$bank_counts" | tr -d ' ') 个题库全部一致"
else
  fail '有题库不一致' "${mismatch[*]}"
fi

# ==================== 2. 题目列表 /list ====================

step '2.1 题目列表：默认参数'
request list_default "$API/list"
expect_ok
check '默认每页 20 条：len(list) == min(20, total)' 'len(L) == min(20, d["data"]["total"])' '[len(L), d["data"]["total"]]'
check '每条题目字段齐全，没有多余字段' 'all(set(q) == QUESTION_FIELDS for q in L)' '[sorted(set(q) ^ QUESTION_FIELDS) for q in L][:1]'
check '只返回正常状态（status=1）的题' 'all(q["status"] == 1 for q in L)' '[q["status"] for q in L]'
check '游客：user_tag=0、user_liked=false' 'all(q["user_tag"] == 0 and q["user_liked"] is False for q in L)'
check '游客：content 不超过 150 字' 'all(len(q["content"]) <= 150 for q in L)' '[len(q["content"]) for q in L]'
check '默认按 order 升序' 'asc([q["order"] for q in L])' '[q["order"] for q in L]'
check '时间格式是 YYYY-MM-DD HH:MM:SS' \
  'all(re.fullmatch(r"\d{4}-\d\d-\d\d \d\d:\d\d:\d\d", q[k]) for q in L for k in ("create_time", "update_time"))' \
  '[q["create_time"] for q in L][:3]'
check 'tags / bank_list 是数组' 'all(isinstance(q["tags"], list) and isinstance(q["bank_list"], list) for q in L)'

step '2.2 题目列表：一次取全部正常题目（后面的交叉校验都用它）'
request all_q "$API/list" page_size=100
expect_ok
check '一页取完：total ≤ 100 且 len(list) == total' 'd["data"]["total"] <= 100 and len(L) == d["data"]["total"]' '[len(L), d["data"]["total"]]'
check 'total 与默认参数时一致' 'd["data"]["total"] == R("list_default")["data"]["total"]'
check '种子：正常状态的题共 30 道' 'd["data"]["total"] == 30' 'd["data"]["total"]'
check '种子：隐藏的 q106 / q125 和已删除的 q111 不出现' 'not ({"q106", "q111", "q125"} & set(ids(L)))'
check '种子：q102 正文 271 字，游客列表里截断为 150 字' 'len(by_id("all_q")["q102"]["content"]) == 150' 'len(by_id("all_q")["q102"]["content"])'

step '2.3 题目列表：分页'
request page1 "$API/list" page=1 page_size=5
expect_ok
request page2 "$API/list" page=2 page_size=5
expect_ok
request page_1_10 "$API/list" page=1 page_size=10
check '第 1 页 + 第 2 页 == page_size=10 的第 1 页' 'ids(R("page1")["data"]["list"]) + ids(R("page2")["data"]["list"]) == ids(L)'
check '两页的 total 相同' 'R("page1")["data"]["total"] == R("page2")["data"]["total"] == d["data"]["total"]'
request page_far "$API/list" page=999 page_size=5
expect_ok
check '超出范围的页：list 为 []（不是 null），total 不变' 'L == [] and d["data"]["total"] == R("all_q")["data"]["total"]' 'd["data"]'
# 分页最多跳过 10000 条：page_size=20 时最后一个合法页是 501（跳过 500*20 = 10000 条），502 起返回参数错误（见 2.6）
request page_cap "$API/list" page=501
expect_ok
check 'page=501（刚好跳过 10000 条）：还在上限内，list 为 []' 'L == [] and d["data"]["total"] == R("all_q")["data"]["total"]' 'd["data"]'

step '2.4 题目列表：过滤'
request f_diff "$API/list" difficulty=3 page_size=100
expect_ok
check 'difficulty=3：有结果且全部是困难题' 'len(L) > 0 and all(q["difficulty"] == 3 for q in L)' '[q["difficulty"] for q in L]'

CUR="$TMP_DIR/all_list.json"
BANK=$(py 'next(b["bank_id"] for g in d["data"] for s in g["series_list"] for b in s["bank_list"] if b["count"] > 0)') ||
  BANK='没取到'
export BANK
request f_bank "$API/list" bank_id="$BANK" page_size=100
expect_ok
check "bank_id=$BANK（从 /all/list 取的第一个非空题库）：每道题的 bank_list 都包含它" \
  'len(L) > 0 and all(E["BANK"] in q["bank_list"] for q in L)' '[q["bank_list"] for q in L]'

request f_tags "$API/list" tags=Go tags=并发 page_size=100
expect_ok
check 'tags=Go&tags=并发：每道题同时有这两个标签' 'len(L) > 0 and all({"Go", "并发"} <= set(q["tags"]) for q in L)' '[q["tags"] for q in L]'
check '种子：命中 q119 / q123 / q124' 'sorted(ids(L)) == ["q119", "q123", "q124"]' 'ids(L)'

request f_kw "$API/list" keyword=redis page_size=100
expect_ok
check 'keyword=redis：大小写不敏感，标题或正文包含 redis' \
  'len(L) > 0 and all("redis" in (q["title"] + q["content"]).lower() for q in L)' '[q["title"] for q in L]'
check '种子：命中 q103（标题小写）和 q105（只有正文里的 REDIS）' '{"q103", "q105"} <= set(ids(L))' 'ids(L)'

request f_kw_special "$API/list" 'keyword=count(*)'
expect_ok
check '种子：keyword=count(*) 按字面匹配（正则特殊字符已转义），只命中 q107' 'ids(L) == ["q107"]' 'ids(L)'

request f_kw_content "$API/list" keyword=两阶段提交
expect_ok
check '种子：keyword=两阶段提交 只在正文里出现，命中 q110' 'ids(L) == ["q110"]' 'ids(L)'

request f_kw_trim "$API/list" 'keyword=  redis  ' page_size=100
expect_ok
check 'keyword 首尾的空格被去掉：结果与 keyword=redis 相同' 'ids(L) == ids(R("f_kw")["data"]["list"])' 'ids(L)'

request f_kw_blank "$API/list" 'keyword=   ' page_size=100
expect_ok
check 'keyword 全是空格：当作没传，结果与不传完全相同' 'ids(L) == ids(R("all_q")["data"]["list"])' 'd["data"]["total"]'

request f_kw_terms "$API/list" 'keyword=Redis 持久化'
expect_ok
check '种子：keyword=Redis 持久化 按空格拆成两个词，两个词都要命中，只有 q101' 'ids(L) == ["q101"]' 'ids(L)'

request f_kw_fullwidth "$API/list" 'keyword=Redis　持久化'
expect_ok
check '全角空格也能拆词：结果与半角空格相同' 'ids(L) == ids(R("f_kw_terms")["data"]["list"])' 'ids(L)'

request f_kw_max "$API/list" "keyword=$(printf '题%.0s' {1..50})"
expect_ok
check 'keyword 50 个字（上限）：正常查询' 'd["code"] == 0' 'd["code"]'

request f_job "$API/list" job_name=后端开发
expect_ok
check '种子：job_name=后端开发 共 21 道' 'd["data"]["total"] == 21' 'd["data"]["total"]'

request f_user_tag "$API/list" user_tag=1 page_size=100
expect_ok
check '游客传 user_tag=1 被忽略：结果与不传完全相同' 'ids(L) == ids(R("all_q")["data"]["list"])' '[d["data"]["total"], R("all_q")["data"]["total"]]'

step '2.5 题目列表：排序'
for spec in 'view_count desc' 'view_count asc' 'create_time desc' 'thumbs_up_count desc' 'dislike_count asc' 'order desc'; do
  read -r field dir <<<"$spec"
  export SORT_FIELD=$field
  request "sort_${field}_$dir" "$API/list" sort_by="$field" sort_order="$dir" page_size=100
  if [[ $dir == asc ]]; then
    check "sort_by=$field&sort_order=asc：非降序" 'd["code"] == 0 and asc([q[E["SORT_FIELD"]] for q in L])' '[q[E["SORT_FIELD"]] for q in L]'
  else
    check "sort_by=$field&sort_order=desc：非升序" 'd["code"] == 0 and desc([q[E["SORT_FIELD"]] for q in L])' '[q[E["SORT_FIELD"]] for q in L]'
  fi
done

# 不传 sort_order 时：时间和计数字段默认降序，order 默认升序
for field in view_count create_time; do
  export SORT_FIELD=$field
  request "sort_${field}_default" "$API/list" sort_by="$field" page_size=100
  check "sort_by=$field 不传 sort_order：默认降序，与 sort_order=desc 相同" \
    'ids(L) == ids(R("sort_" + E["SORT_FIELD"] + "_desc")["data"]["list"])' 'ids(L)'
done
request sort_default "$API/list" page_size=100
check '不传 sort_by：按 order 升序' 'd["code"] == 0 and asc([q["order"] for q in L])' '[q["order"] for q in L]'

step '2.6 题目列表：非法参数'
# MongoDB 的正则不接受 \x00，bash 字符串又放不下 \x00，所以从文件读（curl 的 name@文件 写法）
printf 'a\0b' >"$TMP_DIR/keyword_nul.txt"
for kv in sort_by=hot_degree sort_order=up page=abc page_size=abc difficulty=abc \
  page=502 page=9223372036854775807 "keyword=$(printf '题%.0s' {1..51})" $'keyword=\xff' \
  "keyword@$TMP_DIR/keyword_nul.txt" user_tag=4 user_tag=-1 user_tag=abc; do
  request bad_param "$API/list" "$kv"
  expect_err 400 参数错误
done

# ==================== 3. 题目元数据列表 /meta/list ====================

step '3.1 元数据列表：与 /list 用同样参数，结果一致'
request meta_sorted "$API/meta/list" sort_by=view_count sort_order=desc page_size=100
expect_ok
check '每条只有 question_id 和 title' 'all(set(q) == META_FIELDS for q in L)' '[sorted(q) for q in L][:1]'
check 'total 与 /list 相同' 'd["data"]["total"] == R("sort_view_count_desc")["data"]["total"]'
check '题目顺序、ID 和标题与 /list 完全相同' \
  '[[q["question_id"], q["title"]] for q in L] == [[q["question_id"], q["title"]] for q in R("sort_view_count_desc")["data"]["list"]]'

step '3.2 元数据列表：分页和过滤'
request meta_page2 "$API/meta/list" page=2 page_size=5
expect_ok
check 'page=2&page_size=5 与 /list 的第 2 页相同' 'ids(L) == ids(R("page2")["data"]["list"])' 'ids(L)'
request meta_tags "$API/meta/list" tags=Go tags=并发
expect_ok
check 'tags=Go&tags=并发 与 /list 相同' 'ids(L) == ids(R("f_tags")["data"]["list"])' 'ids(L)'

step '3.3 元数据列表：非法参数'
request meta_bad "$API/meta/list" sort_by=hot_degree
expect_err 400 参数错误

# ==================== 4. 题目详情 /detail ====================

step '4.1 题目详情：从 /list 取第一道题'
CUR="$TMP_DIR/list_default.json"
QID=$(py 'L[0]["question_id"]') || QID='没取到'
export QID
request detail "$API/detail" question_id="$QID"
expect_ok
check "data.question_id == $QID" 'd["data"]["question_id"] == E["QID"]' 'd["data"]["question_id"]'
check '字段齐全：列表的字段 + analysis_content' 'set(d["data"]) == QUESTION_FIELDS | {"analysis_content"}' \
  'sorted(set(d["data"]) ^ (QUESTION_FIELDS | {"analysis_content"}))'
check '列表里有的字段与同一道题完全相同（游客的 content 两边都截断到 150 字）' \
  'all(d["data"][k] == by_id("list_default")[E["QID"]][k] for k in QUESTION_FIELDS)' \
  '[k for k in QUESTION_FIELDS if d["data"][k] != by_id("list_default")[E["QID"]][k]]'
check '游客：user_tag=0、user_liked=false' 'd["data"]["user_tag"] == 0 and d["data"]["user_liked"] is False'
check '游客：analysis_content 为空串' 'd["data"]["analysis_content"] == ""' 'd["data"]["analysis_content"]'
request detail_q102 "$API/detail" question_id=q102
expect_ok
check '种子：q102 正文超过 150 字，游客只拿到前 150 字，看不到尾句' \
  'len(d["data"]["content"]) == 150 and "游客看不到" not in d["data"]["content"]' 'len(d["data"]["content"])'
check '种子：q102 有解析，游客拿到的 analysis_content 仍为空串' 'd["data"]["analysis_content"] == ""' 'd["data"]["analysis_content"]'

step '4.2 题目详情：/list 里的每一道题都能查到，且与列表一致'
CUR="$TMP_DIR/all_q.json"
all_ids=$(py '" ".join(ids(L))') || all_ids=''
bad=()
if [[ -z $all_ids ]]; then
  bad+=('没能从 /list 取到题目 ID')
fi
for qid in $all_ids; do
  export QID=$qid
  QUIET=1 request detail_each "$API/detail" question_id="$qid"
  ok=$(py 'd["code"] == 0 and all(d["data"][k] == by_id("all_q")[E["QID"]][k] for k in QUESTION_FIELDS) and d["data"]["analysis_content"] == ""') || ok=false
  if [[ $ok != true ]]; then
    bad+=("$qid")
  fi
done
if ((${#bad[@]} == 0)); then
  pass "$(wc -w <<<"$all_ids" | tr -d ' ') 道题详情全部与列表一致，analysis_content 都为空串"
else
  fail '有题目详情与列表不一致' "${bad[*]}"
fi

step '4.3 题目详情：异常情况'
request detail_missing "$API/detail"
expect_err 400 参数错误
request detail_none "$API/detail" question_id=q_not_exist
expect_err 400 题目不存在
for qid in q106 q125 q111; do
  printf '  %s种子：%s 是隐藏或已删除的题%s\n' "$DIM" "$qid" "$RESET"
  request detail_hidden "$API/detail" question_id="$qid"
  expect_err 400 题目不存在
done

# ==================== 5. 热门题目列表 /hot/list ====================

step '5.1 热门题目：默认参数'
request hot_default "$API/hot/list"
expect_ok
check '默认 10 条：len(list) == min(10, 正常题总数)' 'len(L) == min(10, R("all_q")["data"]["total"])' 'len(L)'
check '每条只有 question_id / bank_list / title / view_count' 'all(set(q) == HOT_FIELDS for q in L)' '[sorted(q) for q in L][:1]'
check '正好是 hot_degree 最高的那几道，并按 hot_degree 降序' \
  '[by_id("all_q")[i]["hot_degree"] for i in ids(L)] == sorted((q["hot_degree"] for q in R("all_q")["data"]["list"]), reverse=True)[:len(L)]' \
  '[[i, by_id("all_q")[i]["hot_degree"]] for i in ids(L)]'
check 'title / bank_list / view_count 与 /list 一致' 'all(by_id("all_q")[q["question_id"]][k] == q[k] for q in L for k in q)'
check '种子：第一名是 q107（hot_degree=95，view_count 只有 150），隐藏的 q106 / q125 不出现' \
  'ids(L)[0] == "q107" and not ({"q106", "q125"} & set(ids(L)))' 'ids(L)'

step '5.2 热门题目：limit'
request hot_3 "$API/hot/list" limit=3
expect_ok
check 'limit=3：返回默认结果的前 3 条' 'ids(L) == ids(R("hot_default")["data"]["list"])[:3]' 'ids(L)'
request hot_0 "$API/hot/list" limit=0
expect_ok
check 'limit=0：按默认 10 条处理' 'ids(L) == ids(R("hot_default")["data"]["list"])' 'len(L)'
request hot_999 "$API/hot/list" limit=999
expect_ok
check 'limit=999：最多 50 条' 'len(L) == min(50, R("all_q")["data"]["total"])' 'len(L)'
request hot_bad "$API/hot/list" limit=abc
expect_err 400 参数错误

step '5.3 热门题目：job_name'
request list_fe "$API/list" job_name=前端开发 page_size=100
request hot_fe "$API/hot/list" job_name=前端开发
expect_ok
check 'job_name=前端开发：结果都是前端题，数量为 min(10, 前端题总数)' \
  'set(ids(L)) <= set(ids(R("list_fe")["data"]["list"])) and len(L) == min(10, R("list_fe")["data"]["total"])' 'ids(L)'
request hot_none "$API/hot/list" job_name=不存在的方向
expect_ok
check '不存在的 job_name：list 为 []（不是 null）' 'L == []' 'd["data"]'

# ==================== 6. 随机题目列表 /random/list ====================

step '6.1 随机题目列表：同一个种子翻完所有页'
request rand_p1 "$API/random/list" seed=42 page=1 page_size=20
expect_ok
check '带回传入的 seed，total 等于正常题总数' \
  'd["data"]["seed"] == 42 and d["data"]["total"] == R("all_q")["data"]["total"]' 'd["data"]["seed"], d["data"]["total"]'
check '每条只有 question_id 和 title' 'all(set(q) == META_FIELDS for q in L)' '[sorted(q) for q in L][:1]'
request rand_p2 "$API/random/list" seed=42 page=2 page_size=20
expect_ok
request rand_p3 "$API/random/list" seed=42 page=3 page_size=20
expect_ok
check '翻完所有页不重不漏，正好是全部正常题' \
  'sorted(ids(R("rand_p1")["data"]["list"] + R("rand_p2")["data"]["list"] + L)) == sorted(ids(R("all_q")["data"]["list"]))' \
  'len(R("rand_p1")["data"]["list"] + R("rand_p2")["data"]["list"] + L)'
check '标题和 /list 一致' \
  'all(by_id("all_q")[q["question_id"]]["title"] == q["title"] for q in R("rand_p1")["data"]["list"] + R("rand_p2")["data"]["list"] + L)'
check '顺序和默认的 order 顺序不同' \
  'ids(R("rand_p1")["data"]["list"]) != ids(R("all_q")["data"]["list"])[:len(R("rand_p1")["data"]["list"])]'
request rand_again "$API/random/list" seed=42 page=1 page_size=20
expect_ok
check '同一个种子再请求一次，顺序完全相同' 'ids(L) == ids(R("rand_p1")["data"]["list"])' 'ids(L)'
request rand_other "$API/random/list" seed=43 page=1 page_size=20
expect_ok
check '换个种子顺序不同' 'ids(L) != ids(R("rand_p1")["data"]["list"])'
request rand_far "$API/random/list" seed=42 page=99 page_size=20
expect_ok
check '页码超出范围：list 为 []（不是 null），total 不变' \
  'L == [] and d["data"]["total"] == R("all_q")["data"]["total"]' 'd["data"]'

step '6.2 随机题目列表：默认值和非法参数'
request rand_default "$API/random/list"
expect_ok
check '不传 seed：服务端生成一个 1 ~ 2^53 的种子；默认 20 条' \
  '1 <= d["data"]["seed"] <= 2**53 and len(L) == min(20, d["data"]["total"])' 'd["data"]["seed"], len(L)'
SEED=$(py 'd["data"]["seed"]')
request rand_reuse "$API/random/list" seed="$SEED"
expect_ok
check '带上生成的种子再请求，结果相同' 'ids(L) == ids(R("rand_default")["data"]["list"])' 'ids(L)'
request rand_big "$API/random/list" seed=42 page_size=999
expect_ok
check 'page_size=999：最多 50 条' 'len(L) == min(50, d["data"]["total"])' 'len(L)'
for kv in seed=abc page=abc page_size=abc page=502 page=9223372036854775807; do
  request rand_bad "$API/random/list" "$kv"
  expect_err 400 参数错误
done

# ==================== 7. 标签列表 /tag/list ====================

step '7.1 标签列表：全部题目'
request tag_all "$API/tag/list"
expect_ok
check '每条只有 tag 和 count' 'all(set(t) == {"tag", "count"} for t in L)' '[sorted(t) for t in L][:1]'
check '每个标签的题目数和 /list 里数出来的一致' \
  '{t["tag"]: t["count"] for t in L} == {t: sum(t in q["tags"] for q in R("all_q")["data"]["list"]) for q in R("all_q")["data"]["list"] for t in q["tags"]}'
check '按题目数降序，一样多的按标签名升序' 'L == sorted(L, key=lambda t: (-t["count"], t["tag"]))' 'L[:5]'

step '7.2 标签列表：bank_id'
request list_b002 "$API/list" bank_id=b002 page_size=100
request tag_b002 "$API/tag/list" bank_id=b002
expect_ok
check 'bank_id=b002：只统计这个题库的题' \
  'L and {t["tag"]: t["count"] for t in L} == {t: sum(t in q["tags"] for q in R("list_b002")["data"]["list"]) for q in R("list_b002")["data"]["list"] for t in q["tags"]}' 'L'
request tag_none "$API/tag/list" bank_id=不存在的题库
expect_ok
check '不存在的 bank_id：list 为 []（不是 null）' 'L == []' 'd["data"]'

# ==================== 汇总 ====================

printf '\n%s汇总%s：%s通过 %d%s，%s失败 %d%s，%s跳过 %d%s\n' \
  "$BOLD" "$RESET" "$GREEN" "$PASS_COUNT" "$RESET" "$RED" "$FAIL_COUNT" "$RESET" "$YELLOW" "$SKIP_COUNT" "$RESET"
if ((FAIL_COUNT > 0)); then
  printf '%s失败项：%s\n' "$RED" "$RESET"
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi

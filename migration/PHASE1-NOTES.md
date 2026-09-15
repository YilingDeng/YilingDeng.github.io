# Phase 1 施工记录:本地工具链 + 脚手架

> 工作产物,不属于站点内容。可加入 `.gitignore`。
> 完成时间:2026-09-13

## 最终状态

| 项 | 值 |
|---|---|
| 站点目录 | `D:\Website-hugo`(独立 git 仓库,已 `git init`) |
| Hugo | v0.166.0 **+extended** |
| Go | 1.27.0 |
| Node / npm | v22.17.1 / 11.8.0 |
| 模板 | `academic-cv`(HugoBlox CLI 0.12.8) |
| 模块 | `_vendor/` 已固化,556 个文件,后续构建**完全离线** |
| 构建 | `hugo --gc --minify` → 93 页 / 20 别名 / 177 图,**通过** |
| 遥测 | 已关闭 |

工具链**不在** Bash 工具的 PATH 里(winget 改的是用户级 PATH,只对新开的终端生效)。
每条命令都要显式前置:

```bash
export PATH="/c/Users/coral/AppData/Local/Microsoft/WinGet/Packages/Hugo.Hugo.Extended_Microsoft.Winget.Source_8wekyb3d8bbwe:/c/Program Files/Go/bin:$PATH"
```

> 注意必须用 **POSIX 路径**。写成 `$LOCALAPPDATA/...` 会展开成反斜杠形式,Git Bash 解析不了 PATH 条目。

---

## 踩到的 5 个坑(文档里查不到,重做必再撞)

### 1. HugoBlox CLI 在 `D:\Website` 里会崩

```
TypeError: Invalid Version: 0.8.1.1
```

**原因**:`D:\Website\package.json:3` 写的是 `"version": "0.8.1.1"` —— 四段式,
从上游 Academic Pages 模板继承来的,不是合法 semver。CLI 在任何目录下启动都会
扫描 `package.json` 做项目探测,`semver.gt()` 一解析就抛。

**绕法**:从 `D:\` 之类的中性目录发起命令。不要去改那个 `package.json` ——
`D:\Website` 是回滚兜底,在 Phase 5 全绿之前不动它。

### 2. CLI 无法把站建在盘符根目录下

```
EPERM: operation not permitted, mkdir 'D:\'
```

**原因**:CLI 建站前会 `mkdir` 目标目录的**父目录**。`D:\Website-hugo` 的父目录
就是 `D:\`,Windows 上 mkdir 盘符根一律 EPERM。传相对路径也一样(它会先解析成绝对路径)。

**绕法**:先让 CLI 建在 `D:\hbx-scaffold\Website-hugo`,再把成品 `mv` 到
`D:\Website-hugo`。已验证成品里没有写死临时路径。

### 3. CLI 的报错信息是误导性的

第一次失败时它说:

```
✖ HBX_INPUT_ERROR: Failed to clone HugoBlox templates. Ensure git is installed and accessible.
```

而 `git` 完全正常,仓库也拉得下来。真相是这段代码:

```js
await execa("git", ["clone", "--depth", "1", Hr, u], { stdio: "ignore" })
```

`stdio:"ignore"` 把真实错误吞了,而 `catch` 包住的**不只是 clone**,
还包括后面从仓库提取 `templates/<id>` 的步骤。**遇到这个报错先加 `--debug`,不要信字面。**

### 4. `hugo mod vendor` 不走 GOPROXY(本项目最硬的一个坑)

配好 `GOPROXY=https://goproxy.cn,direct` 也没用。报错形态:

```
github.com/HugoBlox/kit/modules/blox@v0.0.0-20260527025321-61f41d3667f1:
  invalid version: git ls-remote -q --end-of-options origin ...
  fatal: unable to access 'https://github.com/HugoBlox/kit/': Failed to connect to github.com port 443
```

**两层原因**:

1. go.mod 锁的是 **pseudo-version**(`v0.0.0-<时间戳>-<hash>`)。这种版本号
   module proxy 只有回源缓存过才拿得到;首次 404 后 Go 会**回落到直连 git**。
2. **Hugo 给自己 spawn 的 `go` 子进程固定了一套 env**(`GOPROXY` / `GOFLAGS` /
   `GOCACHE`,VCS 缓存在 `hugo_cache/modules/filecache/modules/pkg/mod/cache/vcs/` 下)。
   我在 shell 里 `export GOPROXY=https://goproxy.cn` 也没用,Hugo 照样走直连。

**决定性验证**:在项目目录里手工跑 `go mod download -x`,三个模块的
`.mod/.info/.zip` 全部 `200 OK`,**一个 VCS 请求都没发**。所以 Go 和 proxy 都没问题,
是 Hugo 的调用方式问题。

**解法 —— 绕过解析环节,直接灌 Hugo 自己的 GOMODCACHE**:

```bash
cd /d/Website-hugo
GOMODCACHE="C:/Users/coral/AppData/Local/hugo_cache/modules/filecache/modules/pkg/mod" \
GOPROXY=https://goproxy.cn GOSUMDB=off GOFLAGS=-mod=mod \
go mod download all
# 然后正常跑
hugo mod vendor
```

Go 走缓存命中就不再发网络请求,Hugo 也就不需要 git 了。**一次成功。**

> 这也说明方案里"`GOPROXY` 双设 + `hugo mod vendor` 让后续构建完全离线"的设想
> 方向对,但**缺了灌 Hugo 自己 GOMODCACHE 这一步**,光配 GOPROXY 到不了。

### 5. `security.exec.allow` 缺 `tailwindcss`,裸构建必失败

```
TAILWINDCSS: failed to transform "/css/_entry.css" (text/css):
  access denied: "tailwindcss" is not whitelisted in policy "security.exec.allow"
```

**原因**:Hugo **0.165+** 的默认 `security.exec.allow` 是
`['^(dart-)?sass$', '^go$', '^git$', '^node$', '^postcss$']` —— **不含 tailwindcss**。
模板的 `config/_default/hugo.yaml` 只写了 `security: _merge: deep`,模块配置里也没有
提供这一项(已 grep 过 `_vendor/github.com/HugoBlox/kit/modules/*/config`,只有 `slides`
有 config 且不含 security)。

有意思的是 Hugo 的 `security.node.permissions.allowAddons` 里**是**认识 `tailwindcss` 的,
说明它知道这个工具,只是 exec 策略没放行。

> 方案里把这条归因成"Hugo < 0.165.0 把 tailwindcss 留在默认白名单里,所以要升到 0.165.0+",
> **方向反了**:是 0.165+ **移除了**它,模板没跟着补。升级到 0.166.0 反而触发了这个错误。

**修法**(已写入 `config/_default/hugo.yaml`):显式列全默认项再加 tailwindcss:

```yaml
security:
  _merge: deep
  exec:
    allow:
      - ^(dart-)?sass$
      - ^go$
      - ^git$
      - ^node$
      - ^postcss$
      - ^tailwindcss$
```

### 附带修的两处

- `package.json` 的 `"build": "hugo --minify && pnpm run pagefind"` → 改成 `npm`,
  并删掉 `"packageManager": "pnpm@10.14.0"`(用 npm 装的话这行必失败)。
  方案风险 #3 命中了。
- `.npmrc` 里的 `node-linker=hoisted` 是 pnpm 专用配置,npm 每次跑都会警告
  `Unknown project config "node-linker"`。无害,暂留。

---

## `hbx doctor` 结果:10 通过 / 0 警告 / 1 失败

唯一失败项是 **`Pro license: Missing`** —— 这是预期的,你选的就是免费版。
其余全绿:Node / Git / Go / Hugo(extended)/ pnpm / 模板识别 /
**Hugo 版本兼容性(模板要求 0.166.0,运行 0.166.0 —— 我们改的 `hugoblox.yaml` 生效了)** /
三个模块全部 PASS。

(附带发现:这台机器其实装了 pnpm 11.15.0。不过已经改用 npm 了,不影响。)

---

## Phase 2 开工前必须先改的配置

现在 `config/_default/hugo.yaml` 还是模板默认值,跟现有内容**全部冲突**:

| 键 | 当前 | 要改成 | 为什么 |
|---|---|---|---|
| `baseURL` | `https://example.com/` | 你的真实域名 | 结尾斜杠必须有 |
| `defaultContentLanguage` | `en` | `zh` | |
| `hasCJKLanguage` | `false` | **`true`** | 不开的话 Hugo 把整句中文当一个词,`.Summary` 和阅读时间全错 |
| `disableAliases` | `true` | **`false`** | 不改的话 Phase 4 的 `aliases:` 全部不生成,重定向表静默失效 |
| `removePathAccents` | `true` | 保留即可 | 只剥变音符号,**不做 CJK 转写** |
| `imaging.quality` / `imaging.hint` | 有 | 可删 | Hugo 0.163 起废弃,每次构建都刷 WARN |

`baseURL` 之外的四项跟域名无关,可以现在就改。

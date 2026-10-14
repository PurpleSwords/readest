# Fork 维护约定

本 fork 用于自托管 Readest。上游为 `readest/readest`，fork 为
`PurpleSwords/readest`。每日同步、版本升级与生产部署分别管理。

## 远程与分支

| 名称 | 用途 |
| --- | --- |
| `origin` | `https://github.com/PurpleSwords/readest.git`，推送定制代码 |
| `upstream` | `https://github.com/readest/readest.git`，读取上游 |
| `upstream-main` | 自动维护的上游 `main` 镜像，不提交定制改动 |
| `main` | fork 的集成分支，保留自托管修复，通过 PR 更新 |
| `fix/*`、`chore/*` | 从 fork 的 `main` 创建，一项独立改动一个 PR |
| `upgrade/*` | 从 fork 的 `main` 创建，合入选定的正式上游版本 |

新 clone 只包含 `origin`；本地 remote 配置不会随 Git 提交传播。初始化：

```sh
git remote add upstream https://github.com/readest/readest.git
git config remote.pushDefault origin
git fetch upstream --tags
```

## 每日同步

`.github/workflows/sync-upstream.yml` 每天北京时间 04:23 调度，也支持手动运行。
GitHub 的调度可能延迟。它只将 `upstream-main` 快进到官方 `main`，不创建
PR、不合入 fork 的 `main`、不推送标签、不部署。

镜像分支首次运行时自动创建。若上游重写历史或镜像混入定制提交，同步会失败，
不会强推覆盖。此时先核对双方提交，再决定如何修复镜像。

本 fork 只启用 `Sync upstream mirror` 和 `Android E2E (CDP)`。上游继承的
其余工作流（nightly、Nix、Vercel、Docker、CodeQL、PR checks 等）已禁用：它们
依赖上游的发布凭据或仓库设置，在 fork 中只会持续失败。每次升级需检查上游是否
新增工作流，并按同样标准决定是否保持禁用。

同步通过 SSH 使用写权限仓库部署密钥推送，工作流本身只保留
`contents: read`。原因是上游会修改 `.github/workflows/*`，而 GitHub 禁止
Actions 内置的 `GITHUB_TOKEN`（GitHub App 安装令牌）创建或更新工作流文件，
且 `workflows` 权限无法授予该令牌；2026-10-08 至 10-13 的定时同步正是因此失败。

部署密钥 `upstream-mirror (fork sync)` 只对本仓库有写权限，私钥保存在仓库
secret `SYNC_DEPLOY_KEY`。密钥可随时在仓库设置中撤销；轮换时先添加新部署
密钥并更新 secret，再删除旧密钥。密钥缺失时工作流会以明确错误失败。

GitHub 会在公共仓库连续 60 天无活动后停用定时工作流；长期不维护时需在
Actions 页面检查并重新启用。自动同步成功不代表生产环境已升级。

## 上游的 release 方式

2026-10-07 核验：上游最新正式 Release 为 `v0.12.12`，发布于 2026-10-04，
`target_commitish` 为 `main`。近期正式版本也使用 `v…` 标签，没有长期维护的
`release/*` 分支。GitHub Release 关联 Git tag；生产升级应选定这个 tag 对应的
不可变提交，而不是把当前 `main` 当作正式版。

核验命令：

```sh
gh release view --repo readest/readest --json tagName,targetCommitish,publishedAt
git fetch upstream --tags
git rev-parse 'v0.12.12^{commit}'
```

## 升级与独立修复

独立修复从 fork 的 `main` 开分支，测试后向 `PurpleSwords/readest:main` 提 PR。
正式升级按需要进行，不因上游每个提交自动开 PR。示例中的版本号应替换为
实际选定的正式 release tag：

```sh
git switch main
git pull --ff-only origin main
git fetch upstream --tags
git switch -c upgrade/upstream-v0.12.12
git merge --no-ff v0.12.12
# 解决冲突，检查上游 release notes、数据库迁移及工作流变化，完成相关测试。
git push -u origin HEAD
gh pr create --repo PurpleSwords/readest --base main
```

升级 PR 使用 **merge commit** 合并，保留上游祖先关系，避免 squash/rebase 后
下一次升级重复引入同一批上游提交。不要对有定制提交的 `main` 使用
`reset --hard upstream/main` 或强制覆盖式的 fork 同步。

初始 clone 的 `4c3ccfe85` 比 `v0.12.12` 多一个上游提交，不能称为精确的
`v0.12.12` 基线。当前无需回退历史；等正式 tag 覆盖该提交后再按正式版发布，
或者将此前的 fork 构建标记为开发版本。

## fork 版本与部署

- 保留上游 `v*` 标签的原意，不移动、不覆盖，不使用它们命名 fork 的定制发布。
- 基于正式版本的定制标签：`fork-v0.12.12-r1`、`fork-v0.12.12-r2`。
  升级上游版本后，修订号重新从 `r1` 开始。
- 含上游未发布提交时：`fork-v0.12.12-dev.20261007.1`。此时 `v0.12.12`
  只是最近的正式祖先版本，必须同时记录实际上游 SHA。
- 不为 fork 修订号批量修改上游 package/Cargo/Tauri 版本；fork 标签和构建记录
  区分定制版本，应用内显示的上游版本号不能单独作为部署身份。
- 标签固定在已验证的提交上，不移动或复用。每次构建记录 fork tag、完整 fork
  SHA、上游正式 tag、实际纳入的上游 SHA、镜像 digest 与必要迁移说明。
- 生产部署固定镜像 digest，保留上一版 digest 和部署配置用于回滚；涉及数据库
  迁移时单独确认兼容性和备份，不能假定换回旧镜像就足够。
- Git tag 与 GitHub Release 是两件事。推标签本身不会触发现有发布流程；
  发布 GitHub Release 会触发上游继承的 release/Docker 工作流，因此在这些
  工作流完成 fork 适配前，只管理标签，不发布 GitHub Release。

上面的 fork 标签仅为命名示例，本次维护配置不创建应用发布或部署生产环境。

## 保留现有内存优化

线上旧镜像已使用 Turso 内存补丁，本 fork 通过 `pnpm-workspace.yaml`
中的 `patchedDependencies` 配置保留它：`@readest/turso-database-wasm-common@0.7.0-pre.3-readest.0`
初始 shared memory 从 4000 页降至 1024 页（64 MiB），最大值仍为 65536 页。
WASM 二进制和数据库格式保持原样。补丁文件和锁文件随源码版本管理；升级该依赖
时必须重新验证补丁与 WASM 的最小内存要求，不能忽略补丁应用失败。

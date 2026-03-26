# Press Charm - 操作指南

## 网站链接

| 页面 | 链接 |
|------|------|
| 首页 | https://press-charm.vercel.app |
| 商店 | https://press-charm.vercel.app/shop |
| 购物车 | https://press-charm.vercel.app/cart |
| 关于 | https://press-charm.vercel.app/about |
| FAQ | https://press-charm.vercel.app/faq |

## Admin 后台

| 页面 | 链接 |
|------|------|
| 后台首页 | https://press-charm.vercel.app/admin |
| 产品管理 | https://press-charm.vercel.app/admin/products |
| AI 上传 | https://press-charm.vercel.app/admin/upload |
| 订单管理 | https://press-charm.vercel.app/admin/orders |
| 折扣码 | https://press-charm.vercel.app/admin/discounts |

**Admin 密码：** `presscharm2024`

---

## 日常工作流程

### 方式一：全自动（推荐）

```
手机拍照 → 保存到「文件」app → iCloud Drive/PressCharm/new
→ 自动同步到 Mac → Watcher 自动检测
→ Claude AI 生成产品标题、描述、定价
→ Gemini AI 生成手模佩戴图
→ 自动发布到网站
→ Mac 弹出通知
```

**你只需要做的事：** 拍照 → 存到 iCloud Drive/PressCharm/new

**照片处理完后：** 自动移到 iCloud Drive/PressCharm/done

**默认库存：** S 码和 M 码各 1 件，需要改的话去后台 admin/products 调整

### 方式二：手动上传

1. 打开 https://press-charm.vercel.app/admin/upload
2. 拍照或选择图片
3. AI 自动生成产品信息（可编辑）
4. 点「Generate Hand Model」生成手模图
5. 点「Publish」发布

### 方式三：纯手动

1. 打开 https://press-charm.vercel.app/admin/products/new
2. 手动填写所有产品信息
3. 上传图片
4. 保存

---

## 订单处理流程

```
New（新订单）→ Packed（已打包）→ Shipped（已发货）→ Done（完成）
```

1. 收到新订单 → 后台 admin/orders 查看
2. 打包完成 → 状态改为 Packed
3. 准备发货 → 勾选订单 → 点「Export CSV」导出 Pirateship 格式
4. 去 Pirateship 导入 CSV → 购买运单 → 拿到 tracking number
5. 回后台填入 tracking number → 状态改为 Shipped
6. 客户收到 → 状态改为 Done

---

## AI 工作流程

### Claude Vision（产品 Listing）
- **触发时机：** 上传图片时自动调用
- **输出：** 产品名称、描述、价格（美分）、特性列表、护理说明
- **模型：** Claude Sonnet
- **可编辑：** 上传后在后台可以修改任何 AI 生成的内容

### Gemini（手模佩戴图）
- **触发时机：** 自动上架时自动调用，或在产品详情页点「Generate Hand Model」
- **输出：** 一张手模佩戴美甲的效果图
- **模型：** Gemini 2.5 Flash Image
- **注意：** AI 会尽量保留原图的设计和颜色，但可能有细微差异

---

## Watcher 管理

Watcher 是后台守护进程，开机自动运行。

```bash
# 查看状态
launchctl list | grep presscharm

# 查看日志
cat /tmp/presscharm-watcher.log

# 查看错误日志
cat /tmp/presscharm-watcher-error.log

# 重启
launchctl unload ~/Library/LaunchAgents/com.presscharm.watcher.plist
launchctl load ~/Library/LaunchAgents/com.presscharm.watcher.plist

# 停止
launchctl unload ~/Library/LaunchAgents/com.presscharm.watcher.plist
```

---

## 技术栈

| 组件 | 服务 | 费用 |
|------|------|------|
| 网站部署 | Vercel | 免费 |
| 数据库 | Neon PostgreSQL | 免费 |
| 图片存储 | Cloudinary | 免费（25GB） |
| AI 产品描述 | Claude Sonnet | ~$1-5/月 |
| AI 手模图 | Gemini 2.5 Flash | ~$0-2/月 |
| 支付 | Stripe | 2.9% + $0.30/笔 |

---

## 代码更新

```bash
# 在项目目录下修改代码后
cd "/Users/yatingtian/vibe coding prjs/Press Charm/press-charm"
git add .
git commit -m "描述你的改动"
git push origin main
# Vercel 自动部署，1-2 分钟后生效
```

---

## GitHub 仓库

https://github.com/YatingTianTYT/press-charm

# Cinnamon — 红云irch的肉桂卷

个人学习笔记在线浏览网站，基于 GitHub Pages 免费部署。

---

## 快速上手

### 1. 添加笔记

把 `.pdf` 和 `.one` 文件放入 `notes/` 对应文件夹：

```
notes/
└── 普通化学实验（乙）/
    ├── 实验一 基本操作.pdf
    └── 实验一 基本操作.one
```

- PDF 和 .one 文件名相同即自动配对
- 支持无限层级文件夹

### 2. 配置别名（可选）

编辑 `subjects.json`，给文件夹加搜索别名：

```json
{
  "普通化学实验（乙）": ["普化实验", "普化实验乙"]
}
```

### 3. 上传到 GitHub

```bash
git add .
git commit -m "添加笔记"
git push
```

推送后 GitHub Actions 会自动部署，约 1 分钟后网页更新。

---

## 本地预览（可选）

```bash
node scripts/build-index.js   # 生成索引
npx serve .                   # 启动本地服务器
```

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `index.html` | 首页（序言页） |
| `notes.html` | 笔记浏览页 |
| `style.css` | 样式 |
| `app.js` | 前端逻辑 |
| `subjects.json` | 科目搜索别名 |
| `notes-index.json` | 自动生成，勿手动编辑 |
| `scripts/build-index.js` | 扫描 notes/ 生成索引 |

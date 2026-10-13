# UoL Timetable Converter

[![CI](https://github.com/GeniusLv2006/uol-timetables/actions/workflows/ci.yml/badge.svg)](https://github.com/GeniusLv2006/uol-timetables/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

把利物浦大学（University of Liverpool）**My Timetable** 上的课表，转换成可以导入 Google 日历、Apple 日历、Outlook 或其他日历应用的日历文件。

**在线使用：<https://timetables.xjtlu.uk>**

所有处理都在你自己的浏览器里完成。课表不会被上传，也不需要安装软件或注册账号。

![UoL Timetable Converter 首页，展示保存、访问、粘贴、导出四个步骤](docs/images/home.png)

> [!IMPORTANT]
> 这是一个**非官方的独立工具**，与利物浦大学（University of Liverpool）和西交利物浦大学（XJTLU）均无关联，未获得它们的认可，也不由它们运营。`xjtlu.uk` 是个人注册的域名，不是学校网站。课表以 My Timetable 为准，重要课程请务必在那里核对。

网站界面是英文的。下文中的**粗体英文**是网页上按钮或选项的原文，方便你对照查找。如果本文与[英文版](README.md)有出入，以英文版为准。

## 功能

- **一键复制课表**：只需保存一次书签，之后点一下就能复制。
- **生成 `.ics` 日历文件**：日期、时间、教室和教学周都准确，并会自动处理英国夏令时和冬令时的切换。
- **导出前可以自定义**：事件标题、课程简称、提醒、要包含哪些课，以及是否按课程拆分成多个日历。
- **自动提示问题**：比如重复的课程或时间冲突。

![加载示例数据后的转换器：显示 3 门课程、4 个课程安排、11 节课，没有冲突，以及 Export Calendar 按钮](docs/images/converter.png)

## 使用方法

建议在电脑上使用 Chrome、Edge、Firefox 或 Safari。

### 1. 保存提取书签（只需一次）

打开 <https://timetables.xjtlu.uk>，把金色的 **Copy UoL Timetable** 按钮拖到浏览器的书签栏。

如果看不到书签栏，先把它打开（Windows 和 Linux 按 `Ctrl+Shift+B`，Mac 按 `Cmd+Shift+B`）。如果拖不过去，点击 **Copy Bookmarklet Code**，然后手动新建一个书签，把复制的代码粘贴到书签的网址栏里。

### 2. 复制课表

1. 登录 [My Timetable](https://timetables.liverpool.ac.uk/)。
2. 点击左下角菜单里的 **View Semester 1** 或 **View Semester 2**。
3. 点击书签栏里的 **Copy UoL Timetable**。页面上会提示课表已复制。

如果浏览器不允许访问剪贴板，课表会改为下载成一个 `.json` 文件。

### 3. 粘贴到转换器

回到 <https://timetables.xjtlu.uk>，粘贴到 **Timetable JSON** 输入框（`Ctrl+V` 或 `Cmd+V`），或者把下载的 `.json` 文件拖进去。检查预览，按需调整设置，然后点击 **Export Calendar** 并确认，就会下载一个 `.ics` 日历文件。

### 4. 导入日历应用

建议导入到一个**新建的独立日历**里（比如命名为“Semester 1”）。以后课表有变动时，直接删掉这个日历再导入新文件即可，不会影响你的其他日程。

| 应用 | 导入方法 |
| --- | --- |
| Google 日历 | 在电脑上打开 **设置 → 导入和导出 → 导入**，选择 `.ics` 文件和要导入到的日历。 |
| Apple 日历（Mac） | **文件 → 导入**，然后选择 `.ics` 文件。 |
| iPhone 或 iPad | iOS 不能直接从“文件”App 导入下载的 `.ics` 文件。先在“日历”App 里新建一个日历，然后把文件用邮件发给自己，在“邮件”App 里打开附件并添加其中的日程。 |
| Outlook | 网页版 Outlook 选择 **添加日历 → 从文件上传**。桌面版直接打开 `.ics` 文件。 |

## 隐私

- 你的课表、日历文件和保存的设置都只留在你的浏览器里，不会发送给本网站或任何其他人。
- 提取书签只读取页面上显示的课表，绝不读取你的密码、Cookie 或登录信息。
- 网站使用 Cloudflare Web Analytics 统计访问量。它不使用跟踪 Cookie，也看不到你的课表。你可以通过页面底部的 **Privacy** 链接关闭统计。

## 常见问题

**点书签后提示 “No timetable table was found on this page”。**
请确认你停留在显示整个学期课表的 My Timetable 页面（见上面第 2 步），而不是登录页或菜单页。

**日期差了一周，或者复活节之后的课不对。**
转换器根据学期第一个教学周的周一（“Week One”）推算日期。第一学期的日期已经内置。第二学期还没有内置，因为它的教学周被复活节假期隔开了。请在 **Schedule** 设置里手动填写 Week One，并对照 My Timetable 检查复活节之后的课程。

**课表有变动。**
导出的日历只是一份快照，不会自动更新。请重新复制课表、导出新文件，在日历应用里删除旧日历，再导入新文件。

**所有课都差了一小时。**
检查 **Schedule** 设置里的时区，一般应为 `Europe/London`。日历应用会自动按你所在的时区显示时间。

**能在手机上用吗？**
在手机上保存书签比较麻烦，建议用电脑。拿到 `.ics` 文件后，可以在任何设备上导入。

**发现问题或错误。**
欢迎[提交 issue](https://github.com/GeniusLv2006/uol-timetables/issues/new/choose)（英文或中文均可）。请不要附上你的真实课表，因为它包含你的个人日程；描述问题，或者用虚构的数据代替即可。

## 自定义选项

课表加载后，可以在四个标签页里调整日历：

- **Naming**（命名）：事件标题格式、课程简称、日历名称、文件名和建议颜色。
- **Details**（详情）：事件描述里显示哪些内容、提醒，以及地点的写法。
- **Schedule**（日程）：Week One、时区、学期起止日期、包含哪些教学周、阅读周，以及按重复事件还是逐个事件导出。
- **Delivery**（课程类型）：包含哪些类型的课（讲座、研讨课等），以及导出成一个日历，还是按课程或课程类型拆分成多个。

这些设置可以在浏览器里保存为命名的 **profile**（配置），下学期继续使用。配置只保存样式类的选择，日期始终以你加载的课表为准。

## 命令行转换器

如果你习惯用终端，`convert_to_ical.py` 可以把复制的 JSON 转换成与网站默认设置完全相同的日历文件，只需要 Python 3：

```bash
python3 convert_to_ical.py timetable.json timetable.ics
```

与网站不同，这个脚本不知道各学期的 Week One 日期，所以 JSON 里必须包含 `weekOneMonday`；它也只支持 `Europe/London` 时区。详见 [JSON 格式说明](docs/timetable-json.md)（英文）。

## 开发者

```bash
npm install
npm run dev    # 本地预览
npm run check  # 测试、构建和部署预检
```

开发文档均为英文：[贡献指南](CONTRIBUTING.md)、[维护指南](docs/MAINTAINING.md)、[JSON 格式说明](docs/timetable-json.md)、[安全策略](SECURITY.md)。

## 许可证

Copyright © 2026 Tingkai Lyu.

本项目采用 [GNU Affero 通用公共许可证 v3.0（仅此版本）](LICENSE)（`AGPL-3.0-only`）授权。你可以使用、学习、修改和分享它。如果你分发修改后的版本，或者把修改后的版本作为网站或其他网络服务运行，就必须按同样的许可证向用户提供完整源代码。

许可证只涵盖代码，不包括项目名称和本站域名。许可证的法律文本以英文原文为准。

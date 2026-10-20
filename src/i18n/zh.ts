/**
 * 简体中文词典 —— 必须满足 en 词典的形状（`satisfies Dict`），漏译会在编译期报错。
 */
import type { Dict } from './en.ts';

export const dict = {
  meta: {
    name: '色彩实验室',
    langName: '简体中文',
    htmlLang: 'zh-Hans',
    title: '色彩实验室 —— 读出一张照片里的色彩和谐',
  },

  top: {
    helpTitle: '使用说明',
    switchLang: '语言',
    helpAria: '帮助',
  },

  upload: {
    dropHere: '把照片拖到这里，或点击上传',
    busy: '正在读取…',
    pasteTipA: '小技巧：先给照片截个图，再按 ',
    pasteTipB: ' 粘贴进来。',
    pasteKey: '⌘V',
    errorFallback: '出了点问题。',
    aria: '把照片拖到这里，或点击上传',
  },

  map: {
    title: '色相分布',
    noteSampling: '每个点都是你照片上的一个像素，用它自己的颜色。没有一个带编号的点落进来的色团，就是列表里还没有的颜色。',
    noteHarmony: '同一团云，上面压着这条和谐的骨架 —— 方案得活在照片实际拥有的颜色里，而不是照片旁边。',
    dotAria: '第 {{n}} 个取样点 {{hex}}，位于色相分布图上',
    noHues: '这张照片几乎没有彩度 —— 没有色相可画。',
  },

  sample: {
    title: '已取样的颜色',
    suggest: '自动取样',
    suggestWaiting: '照片还在解码 —— 大文件会慢一点，稍等',
    suggestTitle: '为画面里每种还没被代表的颜色补一个代表点 —— 至少 4 个，最多 8 个；没有新颜色可加就停。',
    undo: '撤销',
    undoTitle: '撤销上一步（⌘Z）',
    clear: '清空',
    clearTitle: '移除所有取样点 —— ⌘Z 可以撤回',
    sizeLabel: '取样区域',
    sizeHint:
      '每个点读取照片的范围。小范围精确，但容易带上噪点和颗粒；大范围给出一个区域的色 —— 天空、皮肤、水面 —— '
      + '但会糊过边缘。读数取这片区域的中位值，所以单个高光点拖不动它。已经放好的点保持原来的颜色，拖动它即可重新读取。',
    empty: '还没有取样点。点击照片任意位置，或按「自动 8 点」。',
    namePlaceholder: '给这个颜色起个名字（可选）',
    nameAria: '第 {{n}} 个取样点的名称',
    reorder: '拖动可重新排序 —— 编号会跟着变。Alt+↑/↓ 移动一格。',
    reorderAria: '重新排序第 {{n}} 个取样点 —— 可拖动，或 Alt+方向键',
    copyHex: '复制色值',
    copied: '已复制',
    neutral: '近中性',
    neutralTitle: '几乎没有彩度 —— 它的色相并不可信',
    lock: '锁定 —— 把和谐骨架钉在这个颜色上',
    unlock: '解锁 —— 不再锚定和谐',
    ignore: '分析时忽略',
    include: '重新计入分析',
    del: '删除',
    unnamed: '未命名',
    coverage: '覆盖 · 暗部 {{s}} · 中间调 {{m}} · 亮部 {{h}}',
    noHighlights: '亮部一个点都没取 —— 亮部通常都是带色的。',
    noShadows: '暗部一个点都没取 —— 暗部通常都是带色的。',
    analyze: '放到色相环上分析',
    more: '再加 {{n}} 个点就能继续。',
  },

  stage: {
    groupAria: '照片上的取样点',
    preparing: '正在读取照片…',
    dropReplace: '松开即替换这张照片',
    edge: '跨在边上',
    edgeHint: '光标下的 5×5 区域横跨两种颜色，这个读数是它们混出来的 —— 照片里其实没有这个颜色。请移到平整的区域。',
    dotAria: '第 {{n}} 号取样点：{{label}}',
  },

  wheel: {
    tabNatural: '真实状态',
    tabPure: '纯色相',
    tabGuide: '和谐指引',
    valuesTitle: '色值清单',
    valuesHint: '点击色值即可复制。',
    captionNatural: '按每个颜色真实的饱和度落点。虚线圈是中性区边界。',
    captionPure: '纯色相 —— 所有点都推到外圈，它们之间的夹角就是和谐本身。',
    captionGuide: '每个虚线环都用该点要挪到的建议色填充，箭头从点指向目标。',
    captionCustom: '拖动一个点，在环上放下一个目标。最接近的匹配：{{type}}（{{score}}%）',
    nearNeutral: ' · 近中性',
    dotAria: '第 {{n}} 号取样点，{{hue}}，色相 {{h}} 度',
    dotMovedAria: '第 {{n}} 号取样点，{{hue}}，色相 {{h}} 度，已放置目标 {{to}} 度',
    clearMoveAria: '收回这个目标',
    movesTo: ' · 目标 {{to}}°（{{hex}}）',
  },

  harmony: {
    detected: '检测到的和谐',
    yours: '你选的和谐',
    backToDetected: '回到检测结果',
    needArms: '需要 {{n}} 组不同色相（最多允许一个臂靠移动补上）—— 当前只有 {{have}} 组',
    degenerate: '它需要 {{n}} 组不同色相，而这张照片只有 {{have}} 组 —— 骨架画得出来，但谈不上和声。',
    needDots: '需要 {{n}} 个取样点，才能让每条臂最后都站着一个颜色 —— 当前只有 {{have}} 个',
    // 可能是距离，而不是某个表面的颜色：只说可能
    // 不写"可能"：数字就是保留，而那一条到底是不是远景，只有用户知道
    aerialNote:
      '低彩度、偏亮、偏冷，占画面 {{share}}%。若这是隔着空气看到的远景，把它当成一条臂会压平距离 —— 可以考虑忽略它。',
    builtAround: '围绕：{{list}}',
    feelingLabel: '情绪',
    /** 解释每条建议里的 H/S/L 增量 */
    why: '这个分数怎么来的？',
    drift: '加权漂移',
    slots: '槽位覆盖率',
    worst: '偏移最大的点',
    weights: '权重',
    weightsValue: '彩度 + 画面占比',
    ignoredRow: '被忽略',
    ignoredValue: '你忽略 {{byYou}} 个 · 近中性 {{neutral}} 个',
    agreementValue:
      '人对配色是否相配的判断只有约一半一致（52%；相似人群组内 81%）。'
      + '这个数字描述的是结构，不是美不美。',
    harmonyScoreLabel: '和谐',
    separationLabel: '突出程度',
    separationHint: '另一个维度，不是第二个分数。',
    separationNote:
      '对比让主体跳出来，相似读作和谐。两者方向相反，选一个。',
    warmCoolLabel: '冷暖跨度',
    lightnessLabel: '明度对比',
    warmCoolValue: '最暖 {{warm}} · 最冷 {{cool}}',
    lightnessValue: '最暗 {{dark}} · 最亮 {{light}}',
    adjustments: '调整清单',
    aligned: '✓ 已到位',
    ignored: '已忽略',
    shift: '微调',
    bigShift: '大幅挪动',
    toward: '往 {{hue}} 走',
    degrees: '（{{deg}}°）',
    suggested: '建议色：',
    neutralHint:
      '近中性（S {{s}}%）。这里调色相是看不出来的 —— 真想让这个颜色读作{{hue}}，' +
      '应该去加彩度。',
    inertNote:
      '低于人眼可分辨的差值（ΔE {{de}}）。饱和度只有 {{s}}% 时，它的色相是量化噪声而不是颜色 —— 这里没有可移动的东西。'
      + '如果这块确实应该读作{{hue}}，请改为加彩度。',
    tryAnother: '换一种和谐',
    customNote:
      '拖动一个点就能自己搭。点会留在它自己颜色的位置上，并在环上留下一个目标 —— 目标用你要带它去的那个颜色填充，'
      + '这样照片和方案始终分得清。按 ✕（或 Delete）收回目标。环下方的读数会告诉你现在落在什么结构上。',
    moves: '已放置 {{n}} 个',
    restoreMoves: '全部收回',
    lockedHint:
      '这个颜色被你锁定了，所以这里不会要求你移动它。但它仍然偏离这套骨架 {{deg}}° —— 说明几个锁定彼此冲突，'
      + '请解锁其中一个，或者换一种和谐。',
    flagInvisible: '标记看不见的改动',
    /** 目标色相确定之后，建议色是怎么算出来的 */
    moveLabel: '调整',
    moveHue: '只转色相',
    moveRelative: '保持强度',
    moveHueNote: '建议色保持 HSL 的饱和度与明度完全不变，只有色相滑块会动 —— 这也是色相轮本身唯一能表达的东西。',
    moveRelativeNote:
      'HSL 的饱和度并不均匀：80% 的橙很响亮，80% 的青并不。这个模式保持每个颜色的明度，以及它在自己色相上的'
      + '相对强度 —— 所以饱和度与明度的数字不再是 0。',
  },

  adj: {
    aligned: '已到位',
    ignored: '已忽略',
    /** 色相空间里存在这个移动，但没有眼睛看得见它 */
    inert: '没有可见变化',
    /** 你钉住了它，该让步的是骨架 */
    locked: '已锁定 —— 不动它',
    shift: '往 {{hue}} 微调',
    bigShift: '往 {{hue}} 大幅挪动',
    // 建议要说到「去拉哪个滑块」才可执行
    scope: '作用范围',
    scopeTip:
      '编辑器都是按色带操作的：Lightroom、Camera Raw、Photoshop 色相/饱和度里的「{{band}}」滑块，或 DaVinci Resolve 里 Hue vs Hue 曲线的「{{band}}」端。{{light}}指这个颜色在明度上的位置。',
    memory: '这会离开「{{what}}」的记忆色。',
    memoryWhy: '观众对天空、树叶、肤色有一个记忆色，喜好会跟着它走。挪开之后，即使和声变好，也可能被觉得不对。',
  },

  // 编辑器都有的八个色相滑块，按它们自己的叫法
  hueBand: {
    reds: '红', oranges: '橙', yellows: '黄', greens: '绿',
    aquas: '青', blues: '蓝', purples: '紫', magentas: '品红',
  },
  lightBand: { shadows: '阴影', midtones: '中间调', highlights: '高光' },
  // 有记忆色的东西：按东西命名，不按色相命名
  memory: { sky: '天空', foliage: '树叶', skin: '肤色' },

  app: {
    step1Eyebrow: '第 01 步 —— 取样',
    h1a: '在照片上放点，',
    h1Accent: '取出你想分析的颜色',
    h1b: '。',
    step1Lead:
      '在图上按住拖动即可放一个取样点，拖动已有的点可以微调。' +
      '去取你真正需要信息的颜色 —— 亮部、暗部，以及承载故事的那些颜色。',
    reanalyse: '重新分析：这张图替换了上一张，{{n}} 个取样点保持原位，并按这张重新读取了一遍。',
    editedWarn:
      '这张图已经带有很强的{{cast}}色偏或很高的对比。分析读到的是你给的这张成片，不是当时的场景 —— ' +
      '想要起始调色板，请从 raw 导出一张中性的 JPEG。',
    castWarm: '暖',
    castCool: '冷',
    step2Eyebrow: '第 02 步 —— 读出和谐',
    h2a: '每个颜色，都按它在光谱里的',
    h2Accent: '真实位置',
    h2b: '标出来。',
    step2Lead:
      '在「真实状态」「纯色相」「和谐指引」之间切换。锁定某个颜色，就能把和谐锚在它周围；' +
      '选「自定义」，则可以随意拖动这些点。',
    backToSampling: '回到取样',
    yourPhoto: '你的照片',
    noPhotoThumb: '还没有照片 —— 放上取样点之后色相环才会有内容。',
    wheelViewAria: '色相环视图',
    helpTitle: '这是怎么回事',
    closeHelp: '关闭说明',
  },

  help: {
    eyebrow: '四个步骤。每张照片。',
    s1t: '意图',
    s1d: '在碰任何滑块之前，先确定故事和情绪。这一步工具做不了 —— 也不该它做。你的答案才把一个和谐变成一种风格。',
    s2t: '分析',
    s2d: '取照片里真实存在的颜色。几乎没有什么是纯白或纯黑：亮部和暗部都带着色，而肉眼看不出带多少。最少五个点，通常六到九个最合适。',
    s3t: '选色',
    s3d: '挑一个能支撑故事的和谐。工具把数学上的匹配度排出来，决定权在你。想要怀旧？邻近色通常最合适。想要张力？互补或四方。',
    s4t: '落地',
    s4d: '在你的软件里带着目的去调。用蒙版逐块处理 —— 分通道曲线、色彩平衡、颜色混合器 —— 一次一个颜色，把它们往你选定的槽位挪。',
    wheelTitle: '怎么读这个色相环',
    wNatural: '真实状态',
    wNaturalD: '按每个点真实的饱和度落点。大多数点都挤在中心附近 —— 这才是诚实的画面；虚线圈标出的位置，再往里彩度就低到色相毫无意义了。',
    wPure: '纯色相',
    wPureD: '把每个点都推到外圈，它们之间的夹角 —— 也就是真正的和谐 —— 就读得出来了。',
    wGuide: '和谐指引',
    wGuideD: '用虚线圆标出目标位置，并从每个偏离的点画一支箭头。',
    knowing: '值得知道的事',
    know1: '饱和度 1% 的颜色没有可信的色相。工具照样会给你一支箭头，但它下面的标记会告诉你这个改动是看不见的 —— 该动的是饱和度或明度。',
    know2: '锁定一个点，就是把和谐骨架钉在那个颜色上。当某个颜色不可妥协时就用它。',
    know3: '忽略一个点，它就完全不参与打分。',
    know4: '权重把彩度和该颜色占画面的比例合在一起，所以一大片天空的发言权大过一朵小花。',
    shortcuts: '快捷键',
    scPaste: '把剪贴板里的截图作为照片',
    scUndo: '撤销上一次对取样点的改动',
    scNudge: '微调当前选中的点（按 ⇧ 加大步长）',
    scDelete: '删除当前选中的点',
    scEsc: '取消选中 / 关闭这个面板',
    privacy:
      '什么都不会上传。图片在本标签页里解码进 canvas，逐像素读取，关掉就没有了 —— 关于这张照片的东西' +
      '一样都不存，刷新即清空。这个浏览器里只保留偏好：语言、提示、建议算法、取样区域。',
  },


  /** 编辑器滑杆上要填的三个数 */
  hsl: {
    h: '色相', s: '饱和', l: '明度',
    cell: '当前 {{from}}{{unit}}，目标 {{to}}{{unit}} —— 移动 {{delta}}{{unit}}。',
    none: '不用动',
  },

  harmonyFeeling: {
    short: {
      'split-complementary': '克制',
      'double-split-complementary': '饱满',
      tetradic: '热闹',
      rectangle: '成双',
      analogous: '安静',
      complementary: '对峙',
      triadic: '明快',
      monochromatic: '极简',
      custom: '由你',
    },
    long: {
      'split-complementary':
        '被压住的张力：从补色的两侧斜着切过去，画面因此保持鲜活却不必正面对撞。适合想要“讲究”而不是“响亮”的片子。',
      'double-split-complementary':
        '色轮两边都各切一刀，谁都不正面对撞 —— 四臂里最鲜活、最高对比的一种，也最容易调出“光泽感”。',
      tetradic:
        '四个色族各往一个方向拉 —— 好玩、玩具感、热闹。它读起来是“丰富”，也最容易调过头：让一个槽位当主角，其余压小。',
      rectangle:
        '两对互补色，一对当主角、一对作陪 —— 四色但自带主次。比一对互补更丰富，比四个平等的四方更收得住。',
      analogous:
        '一种情绪，几乎没有摩擦。让照片读起来像“回忆起来的”而不是“当场看到的” —— 怀旧、天气、记忆。',
      complementary:
        '两个色族迎面站在一起。直接、高对比、一眼就看出是安排过的 —— 用在讲的是“冲突”而不是“氛围”的时候。',
      triadic:
        '三个均衡的重音：明快、有图形感，比方正更平均，比互补更不具攻击性。适合把色彩本身当主体。',
      monochromatic:
        '单一色相。安静、克制、略带忧郁，也是最快把叙事交给光线与质感、而不是交给色彩的办法。',
      custom:
        '你自己搭的结构。读数会告诉你落在了什么上面；情绪由你定。',
    },
  },

  hue: {
    red: '红',
    'red-orange': '红橙',
    orange: '橙',
    yellow: '黄',
    'yellow-green': '黄绿',
    green: '绿',
    'teal-green': '蓝绿',
    cyan: '青',
    turquoise: '绿松石',
    'sky-blue': '天蓝',
    azure: '蔚蓝',
    blue: '蓝',
    indigo: '靛',
    violet: '紫罗兰',
    purple: '紫',
    magenta: '品红',
    pink: '粉',
  },

  harmonyName: {
    'split-complementary': '分裂互补',
    'double-split-complementary': '双重分裂互补',
    tetradic: '四色',
    rectangle: '矩形',
    analogous: '邻近',
    complementary: '互补',
    triadic: '三角',
    monochromatic: '单色',
    custom: '自定义',
  },

} satisfies Dict;

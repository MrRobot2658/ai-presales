export interface HtmlComponentDef {
  type: string
  labelKey: string
  html: string
}

export const HTML_COMPONENT_DEFS: HtmlComponentDef[] = [
  { type: 'h1', labelKey: 'presales.editor.components.h1', html: '<h1>一级标题</h1>' },
  { type: 'h2', labelKey: 'presales.editor.components.h2', html: '<h2>二级标题</h2>' },
  { type: 'h3', labelKey: 'presales.editor.components.h3', html: '<h3>三级标题</h3>' },
  { type: 'p', labelKey: 'presales.editor.components.p', html: '<p>正文段落</p>' },
  { type: 'ul', labelKey: 'presales.editor.components.ul', html: '<ul><li>列表项 1</li><li>列表项 2</li></ul>' },
  { type: 'ol', labelKey: 'presales.editor.components.ol', html: '<ol><li>步骤 1</li><li>步骤 2</li></ol>' },
  {
    type: 'section',
    labelKey: 'presales.editor.components.section',
    html: '<section class="slide"><h2>章节标题</h2><p>章节内容</p></section>',
  },
  { type: 'hr', labelKey: 'presales.editor.components.hr', html: '<hr />' },
  { type: 'blockquote', labelKey: 'presales.editor.components.blockquote', html: '<blockquote>引用内容</blockquote>' },
  { type: 'img', labelKey: 'presales.editor.components.img', html: '<p><img src="" alt="图片描述" /></p>' },
  {
    type: 'table',
    labelKey: 'presales.editor.components.table',
    html: '<table><thead><tr><th>列 1</th><th>列 2</th></tr></thead><tbody><tr><td>内容</td><td>内容</td></tr></tbody></table>',
  },
]

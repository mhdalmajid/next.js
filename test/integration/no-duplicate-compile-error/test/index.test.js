/* eslint-env jest */
import {
  check,
  clickReloadOnFullRefreshWarning,
  File,
  findPort,
  hasRedbox,
  killApp,
  launchApp,
} from 'next-test-utils'
import webdriver from 'next-webdriver'
import { join } from 'path'

const appDir = join(__dirname, '../')

describe('no duplicate compile error output', () => {
  it('should not show compile error on page refresh', async () => {
    let stderr = ''

    const appPort = await findPort()
    const app = await launchApp(appDir, appPort, {
      env: { __NEXT_TEST_WITH_DEVTOOL: true },
      onStderr(msg) {
        stderr += msg || ''
      },
    })

    const browser = await webdriver(appPort, '/')

    await browser.waitForElementByCss('#a')

    const f = new File(join(appDir, 'pages', 'index.js'))
    f.replace('<div id="a">hello</div>', '<div id="a"!>hello</div>')

    try {
      // Wait for compile error:
      expect(await hasRedbox(browser, true)).toBe(true)

      await browser.refresh()

      // Wait for compile error to re-appear:
      expect(await hasRedbox(browser, true)).toBe(true)
    } finally {
      f.restore()
    }

    await clickReloadOnFullRefreshWarning(browser)

    // Wait for compile error to disappear:
    await check(
      () => hasRedbox(browser, false).then((r) => (r ? 'yes' : 'no')),
      /no/
    )
    await browser.waitForElementByCss('#a')

    function getRegexCount(str, regex) {
      return (str.match(regex) || []).length
    }

    const correctMessagesRegex = /Caused by:/g
    const totalMessagesRegex = /Unexpected token/g

    const correctMessages = getRegexCount(stderr, correctMessagesRegex)
    const totalMessages = getRegexCount(stderr, totalMessagesRegex)

    expect(correctMessages).toBeGreaterThanOrEqual(1)
    expect(correctMessages).toBe(totalMessages)

    await killApp(app)
  })
})

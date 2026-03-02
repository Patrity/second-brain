import { getAppVersion } from '~~/server/utils/app-version'

export default defineEventHandler(async () => {
  const { version: currentVersion, channel } = getAppVersion()
  const npmTag = channel === 'latest' ? 'latest' : channel

  let latestVersion: string | null = null
  let updateAvailable = false

  try {
    const res = await $fetch<{ version: string }>(
      `https://registry.npmjs.org/cognova/${npmTag}`
    )
    latestVersion = res.version
    updateAvailable = latestVersion !== currentVersion
  } catch {
    latestVersion = null
  }

  return {
    data: {
      currentVersion,
      channel,
      latestVersion,
      updateAvailable,
      updateCommand: updateAvailable
        ? (channel === 'latest' ? 'cognova update' : `cognova update --channel ${channel}`)
        : null
    }
  }
})

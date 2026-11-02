package com.stogofest.chronos

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process

/** Reads per-app foreground time from Android's UsageStatsManager (the data Digital Wellbeing shows). */
object UsageReader {

    data class AppUsage(
        val packageName: String,
        val label: String,
        val systemCategory: Int,
        val isGame: Boolean,
        val intervals: MutableList<LongArray> = mutableListOf(),
        var totalMs: Long = 0,
        var crossCheckMs: Long = 0
    )

    /** True only when the user has switched on Usage Access for CHRONOS. */
    fun hasPermission(context: Context): Boolean {
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        else
            @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return if (mode == AppOpsManager.MODE_DEFAULT)
            context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
        else mode == AppOpsManager.MODE_ALLOWED
    }

    /** Foreground intervals per app between [from] and [to], built from foreground/background events. */
    fun read(context: Context, from: Long, to: Long): List<AppUsage> {
        if (!hasPermission(context)) return emptyList()
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val pm = context.packageManager
        val ignore = mutableSetOf("com.android.systemui", "android")
        pm.resolveActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), PackageManager.MATCH_DEFAULT_ONLY)
            ?.activityInfo?.packageName?.let { ignore.add(it) }   // the home screen is not "screen time" in an app

        val apps = HashMap<String, AppUsage>()
        val open = HashMap<String, Long>()
        fun app(pkg: String): AppUsage = apps.getOrPut(pkg) {
            var label = pkg; var cat = -1; var game = false
            try {
                val ai = pm.getApplicationInfo(pkg, 0)
                label = pm.getApplicationLabel(ai).toString()
                cat = ai.category
                @Suppress("DEPRECATION")
                game = cat == ApplicationInfo.CATEGORY_GAME || (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0
            } catch (_: Exception) { }
            AppUsage(pkg, label, cat, game)
        }
        fun close(pkg: String, end: Long) {
            val start = open.remove(pkg) ?: return
            if (end > start) { val a = app(pkg); a.intervals.add(longArrayOf(start, end)); a.totalMs += end - start }
        }

        val events = usm.queryEvents(from, to)
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            val pkg = e.packageName ?: continue
            when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> {
                    if (pkg in ignore) { open.keys.toList().forEach { close(it, e.timeStamp) }; continue }
                    // Only one app is in front at a time: close whatever was open.
                    open.keys.filter { it != pkg }.forEach { close(it, e.timeStamp) }
                    if (!open.containsKey(pkg)) open[pkg] = e.timeStamp
                }
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
                    if (pkg in ignore) continue
                    if (!open.containsKey(pkg) && apps[pkg]?.intervals.isNullOrEmpty() && e.timeStamp - from < 6 * 3600_000L) {
                        // Already in front when the period began.
                        open[pkg] = from
                    }
                    close(pkg, e.timeStamp)
                }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.KEYGUARD_SHOWN, UsageEvents.Event.DEVICE_SHUTDOWN ->
                    open.keys.toList().forEach { close(it, e.timeStamp) }
            }
        }
        val end = minOf(to, System.currentTimeMillis())
        open.keys.toList().forEach { close(it, end) }

        // Cross-check against Android's own daily totals.
        try {
            usm.queryAndAggregateUsageStats(from, to).forEach { (pkg, s) ->
                apps[pkg]?.crossCheckMs = s.totalTimeInForeground
            }
        } catch (_: Exception) { }
        return apps.values.filter { it.totalMs >= 1000 }.sortedByDescending { it.totalMs }
    }
}

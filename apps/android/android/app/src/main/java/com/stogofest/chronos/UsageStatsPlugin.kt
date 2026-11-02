package com.stogofest.chronos

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.Executors

/**
 * UsageStatsPlugin — gives the CHRONOS web UI real per-app screen time.
 * Nothing is read until the user turns on Usage Access in Android Settings.
 */
@CapacitorPlugin(name = "UsageStats")
class UsageStatsPlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()

    override fun load() {
        UsageRefreshWorker.schedule(context)   // refresh every 15 minutes
    }

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        call.resolve(JSObject().put("granted", UsageReader.hasPermission(context)))
    }

    /** Opens Settings → Usage Access so the user can allow CHRONOS. */
    @PluginMethod
    fun openUsageSettings(call: PluginCall) {
        val withPkg = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + context.packageName))
        val plain = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        try {
            activity.startActivity(withPkg)
        } catch (_: Exception) {
            try { activity.startActivity(plain) } catch (e: ActivityNotFoundException) { call.reject("Settings screen not available"); return }
        }
        call.resolve()
    }

    @PluginMethod
    fun getUsage(call: PluginCall) {
        val now = System.currentTimeMillis()
        val from = call.getLong("from") ?: (now - 86_400_000L)
        val to = call.getLong("to") ?: now
        if (!UsageReader.hasPermission(context)) { call.reject("permission"); return }
        worker.execute {
            try {
                val list = JSArray()
                UsageReader.read(context, from, to).forEach { a ->
                    val iv = JSArray()
                    a.intervals.forEach { iv.put(JSArray().put(it[0]).put(it[1])) }
                    list.put(JSObject()
                        .put("packageName", a.packageName)
                        .put("label", a.label)
                        .put("systemCategory", a.systemCategory)
                        .put("isGame", a.isGame)
                        .put("totalMs", a.totalMs)
                        .put("crossCheckMs", a.crossCheckMs)
                        .put("intervals", iv))
                }
                call.resolve(JSObject().put("apps", list).put("checkedAt", System.currentTimeMillis()))
            } catch (e: Exception) {
                call.reject("Could not read usage")
            }
        }
    }

    /** Totals saved by the background refresh, for an instant first paint. */
    @PluginMethod
    fun getCachedSnapshot(call: PluginCall) {
        val json = context.getSharedPreferences(UsageRefreshWorker.PREFS, 0).getString(UsageRefreshWorker.KEY, null)
        call.resolve(JSObject().put("snapshot", json))
    }
}

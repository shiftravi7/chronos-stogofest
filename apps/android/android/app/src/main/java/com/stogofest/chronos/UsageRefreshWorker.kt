package com.stogofest.chronos

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.TimeUnit

/** Every 15 minutes: saves today's per-app totals so the dashboard opens instantly. */
class UsageRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        if (!UsageReader.hasPermission(applicationContext)) return Result.success()
        val start = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val apps = JSONObject()
        UsageReader.read(applicationContext, start, System.currentTimeMillis()).forEach { apps.put(it.packageName, it.totalMs) }
        val snapshot = JSONObject().put("at", System.currentTimeMillis()).put("apps", apps)
        applicationContext.getSharedPreferences(PREFS, 0).edit().putString(KEY, snapshot.toString()).apply()
        return Result.success()
    }

    companion object {
        const val PREFS = "chronos"
        const val KEY = "snapshot"
        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<UsageRefreshWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("chronos-usage-refresh", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}

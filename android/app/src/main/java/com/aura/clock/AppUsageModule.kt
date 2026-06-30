package com.aura.clock

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

class AppUsageModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppUsageModule"

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    promise.resolve(hasPermission())
  }

  @ReactMethod
  fun openUsageAccessSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("USAGE_SETTINGS_ERROR", "Could not open Usage Access settings.", error)
    }
  }

  @ReactMethod
  fun getTodayUsage(promise: Promise) {
    if (!hasPermission()) {
      promise.resolve(Arguments.createArray())
      return
    }

    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val calendar = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val startTime = calendar.timeInMillis
      val endTime = System.currentTimeMillis()
      val stats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTime,
        endTime
      )
      val packageManager = reactContext.packageManager
      val rows = Arguments.createArray()

      stats
        .filter { it.totalTimeInForeground > 0 }
        .sortedByDescending { it.totalTimeInForeground }
        .forEach { item ->
          val map = Arguments.createMap()
          val appName = try {
            val appInfo = packageManager.getApplicationInfo(item.packageName, 0)
            packageManager.getApplicationLabel(appInfo).toString()
          } catch (_: Exception) {
            item.packageName
          }

          map.putString("packageName", item.packageName)
          map.putString("appName", appName)
          map.putDouble("totalTimeMs", item.totalTimeInForeground.toDouble())
          map.putDouble("lastTimeUsed", item.lastTimeUsed.toDouble())
          rows.pushMap(map)
        }

      promise.resolve(rows)
    } catch (error: Exception) {
      promise.reject("USAGE_QUERY_ERROR", "Could not read app usage stats.", error)
    }
  }

  private fun hasPermission(): Boolean {
    val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        reactContext.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        reactContext.packageName
      )
    }

    return mode == AppOpsManager.MODE_ALLOWED
  }
}

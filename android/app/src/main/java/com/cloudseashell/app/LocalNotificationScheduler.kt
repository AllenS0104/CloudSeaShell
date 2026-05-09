package com.cloudseashell.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object LocalNotificationScheduler {
  fun schedule(
    context: Context,
    id: String,
    title: String,
    body: String,
    triggerAtMs: Long,
    locationName: String = "当前地点",
  ): String {
    val pendingIntent = createPendingIntent(
      context = context,
      id = id,
      title = title,
      body = body,
      locationName = locationName,
      flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    ) ?: throw IllegalStateException("Unable to create notification alarm")
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (alarmManager.canScheduleExactAlarms()) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
        "exact-alarm"
      } else {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
        "inexact-fallback"
      }
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
      "exact-alarm"
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
      "exact-alarm"
    }
  }

  fun cancel(context: Context, id: String) {
    val pendingIntent = createPendingIntent(
      context = context,
      id = id,
      title = "",
      body = "",
      locationName = "",
      flags = PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
    ) ?: return
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
  }

  private fun createPendingIntent(
    context: Context,
    id: String,
    title: String,
    body: String,
    locationName: String,
    flags: Int,
  ): PendingIntent? {
    val intent = Intent(context, ObservationReminderReceiver::class.java).apply {
      action = "${context.packageName}.LOCAL_NOTIFICATION.$id"
      putExtra(ObservationReminderReceiver.EXTRA_TITLE, title)
      putExtra(ObservationReminderReceiver.EXTRA_BODY, body)
      putExtra(ObservationReminderReceiver.EXTRA_LOCATION_NAME, locationName)
      putExtra(ObservationReminderReceiver.EXTRA_REMINDER_ID, id)
    }
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags)
  }
}

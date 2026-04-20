package com.cloudseashell.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class ObservationReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    createNotificationChannel(context)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pendingLaunchIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: "cloudsea-reminder"
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "云海观测提醒"
    val locationName = intent.getStringExtra(EXTRA_LOCATION_NAME) ?: "当前地点"
    val body = intent.getStringExtra(EXTRA_BODY)?.ifBlank {
      "$locationName 已到观测提醒时间。"
    } ?: "$locationName 已到观测提醒时间。"

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingLaunchIntent)
      .build()

    NotificationManagerCompat.from(context).notify(reminderId.hashCode(), notification)
  }

  private fun createNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "CloudSea 观测提醒",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "云海观测提醒通知"
    }
    manager.createNotificationChannel(channel)
  }

  companion object {
    const val CHANNEL_ID = "cloudsea_observation_reminders"
    const val EXTRA_TITLE = "extra_title"
    const val EXTRA_BODY = "extra_body"
    const val EXTRA_LOCATION_NAME = "extra_location_name"
    const val EXTRA_REMINDER_ID = "extra_reminder_id"
  }
}

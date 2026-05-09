package com.cloudseashell.app

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocalNotificationsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "LocalNotifications"

  @ReactMethod
  fun scheduleLocalNotification(id: String, title: String, body: String, triggerAtMs: Double, promise: Promise) {
    try {
      require(id.isNotBlank()) { "id missing" }
      val transport = LocalNotificationScheduler.schedule(
        context = reactContext,
        id = id,
        title = title.ifBlank { "云海观测提醒" },
        body = body,
        triggerAtMs = triggerAtMs.toLong(),
      )

      val result = Arguments.createMap().apply {
        putBoolean("scheduled", true)
        putString("id", id)
        putDouble("triggerAtMs", triggerAtMs)
        putString("transport", transport)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LOCAL_NOTIFICATION_SCHEDULE_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun cancelLocalNotification(id: String, promise: Promise) {
    try {
      require(id.isNotBlank()) { "id missing" }
      LocalNotificationScheduler.cancel(reactContext, id)

      val result = Arguments.createMap().apply {
        putBoolean("cancelled", true)
        putString("id", id)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("LOCAL_NOTIFICATION_CANCEL_ERROR", error.message, error)
    }
  }
}

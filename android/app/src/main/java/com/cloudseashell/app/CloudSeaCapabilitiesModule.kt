package com.cloudseashell.app

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream
import java.util.Base64

class CloudSeaCapabilitiesModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CloudSeaCapabilities"

  @ReactMethod
  fun scheduleObservationReminder(payload: ReadableMap, promise: Promise) {
    try {
      val reminderId = payload.getString("reminderId") ?: throw IllegalArgumentException("reminderId missing")
      val title = payload.getString("title") ?: "云海观测提醒"
      val body = payload.getString("body") ?: ""
      val fireAt = payload.getString("fireAt") ?: throw IllegalArgumentException("fireAt missing")
      val locationName = payload.getString("locationName") ?: "当前地点"
      val triggerAtMillis = java.time.Instant.parse(fireAt).toEpochMilli()

      LocalNotificationScheduler.schedule(
        context = reactContext,
        id = reminderId,
        title = title,
        body = body,
        triggerAtMs = triggerAtMillis,
        locationName = locationName,
      )

      val result = Arguments.createMap().apply {
        putBoolean("scheduled", true)
        putString("reminderId", reminderId)
        putString("fireAt", fireAt)
        putString("transport", "android-notification")
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("REMINDER_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun shareImage(payload: ReadableMap, promise: Promise) {
    try {
      val title = payload.getString("title") ?: "云海观测海报"
      val text = if (payload.hasKey("text")) payload.getString("text") ?: "" else ""
      val dataUrl = payload.getString("dataUrl") ?: throw IllegalArgumentException("dataUrl missing")
      val filename = payload.getString("filename") ?: "cloud-sea-brief.png"
      val file = createSharedImageFile(dataUrl, filename)
      val uri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        file,
      )

      val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        if (text.isNotBlank()) putExtra(Intent.EXTRA_TEXT, text)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      reactContext.startActivity(Intent.createChooser(shareIntent, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

      val result = Arguments.createMap().apply {
        putBoolean("accepted", true)
      }
      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("SHARE_IMAGE_ERROR", error.message, error)
    }
  }

  private fun createSharedImageFile(dataUrl: String, filename: String): File {
    val base64Payload = dataUrl.substringAfter(",", dataUrl)
    val bytes = Base64.getDecoder().decode(base64Payload)
    val directory = File(reactContext.cacheDir, "shared-images").apply { mkdirs() }
    val safeFile = File(directory, filename.ifBlank { "cloud-sea-brief.png" })
    FileOutputStream(safeFile).use { output ->
      output.write(bytes)
      output.flush()
    }
    return safeFile
  }
}

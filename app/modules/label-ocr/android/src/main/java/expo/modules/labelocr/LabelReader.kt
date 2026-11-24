package expo.modules.labelocr

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

class LabelReaderException(val code: String, message: String) : Exception(message)

// Reads the text on a nutrition label photo, fully on the phone, with Tesseract OCR.
// Kept free of Expo/React Native types so it can be tested on its own (androidTest/ and selfTest()).
object LabelReader {
  const val MODEL_ASSET = "tessdata/eng.traineddata"
  const val SAMPLE_ASSET = "labelocr/sample-label.png"

  private val modelLock = ReentrantLock()

  fun readUri(ctx: Context, uri: Uri): String = read(ctx, loadBitmap(ctx, uri))

  // Reads the label image bundled with the app. Used by the in-app "Test label scanner" and by CI.
  fun readSample(ctx: Context): String {
    val bmp = ctx.assets.open(SAMPLE_ASSET).use { BitmapFactory.decodeStream(it) }
      ?: throw LabelReaderException("ERR_IMAGE", "Could not open the sample label")
    return read(ctx, grayscale(bmp, 0f))
  }

  fun read(ctx: Context, bitmap: Bitmap): String {
    val dataDir = ensureModel(ctx)
    val api = TessBaseAPI()
    try {
      if (!api.init(dataDir.absolutePath, "eng")) {
        throw LabelReaderException("ERR_OCR_INIT", "Could not start the text reader")
      }
      api.pageSegMode = TessBaseAPI.PageSegMode.PSM_AUTO
      api.setImage(bitmap)
      return api.getUTF8Text() ?: ""
    } finally {
      api.recycle()
      bitmap.recycle()
    }
  }

  // Tesseract reads models from <dir>/tessdata/; copy the bundled one there once, and again after each
  // app update. Only stream APIs are used on the asset: the app build may store it compressed, and
  // AssetManager.openFd() (file descriptor, length) throws for compressed assets. That was the
  // "This file can not be opened as a file descriptor; it is probably compressed" scan failure in 2.1.0.
  fun ensureModel(ctx: Context): File = modelLock.withLock {
    val base = File(ctx.filesDir, "tesseract")
    val target = File(base, MODEL_ASSET)
    val stamp = File(base, "tessdata/eng.version")
    val wanted = appStamp(ctx)
    val current = if (stamp.exists()) stamp.readText() else ""
    if (!target.exists() || target.length() == 0L || current != wanted) {
      target.parentFile?.mkdirs()
      val tmp = File(target.parentFile, "eng.traineddata.tmp")
      try {
        ctx.assets.open(MODEL_ASSET).use { input -> tmp.outputStream().use { input.copyTo(it) } }
        if (tmp.length() == 0L) throw LabelReaderException("ERR_OCR_MODEL", "The text reader's language file is missing")
        target.delete()
        if (!tmp.renameTo(target)) throw LabelReaderException("ERR_OCR_MODEL", "Could not install the text reader's language file")
        stamp.writeText(wanted)
      } finally {
        tmp.delete()
      }
    }
    base
  }

  // Changes whenever the app is installed or updated.
  private fun appStamp(ctx: Context): String = try {
    ctx.packageManager.getPackageInfo(ctx.packageName, 0).lastUpdateTime.toString()
  } catch (e: Exception) {
    "unknown"
  }

  // Decode at a sensible size (labels need ~1500-2500 px on the long side), upright, in grayscale.
  private fun loadBitmap(ctx: Context, uri: Uri): Bitmap {
    val resolver = ctx.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw LabelReaderException("ERR_IMAGE", "Could not open the photo")
    }
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 2000) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    val raw = resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw LabelReaderException("ERR_IMAGE", "Could not read the photo")

    val rotation = try {
      resolver.openInputStream(uri)?.use {
        when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> 0f
        }
      } ?: 0f
    } catch (e: Exception) {
      0f
    }
    return grayscale(raw, rotation)
  }

  private fun grayscale(raw: Bitmap, rotation: Float): Bitmap {
    val out = Bitmap.createBitmap(
      if (rotation == 90f || rotation == 270f) raw.height else raw.width,
      if (rotation == 90f || rotation == 270f) raw.width else raw.height,
      Bitmap.Config.ARGB_8888
    )
    val m = Matrix().apply {
      postRotate(rotation, raw.width / 2f, raw.height / 2f)
      postTranslate((out.width - raw.width) / 2f, (out.height - raw.height) / 2f)
    }
    val gray = Paint(Paint.FILTER_BITMAP_FLAG).apply {
      colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
    }
    Canvas(out).drawBitmap(raw, m, gray)
    raw.recycle()
    return out
  }
}

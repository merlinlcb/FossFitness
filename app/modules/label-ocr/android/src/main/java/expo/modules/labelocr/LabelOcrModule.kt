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
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Reads the text on a nutrition label photo, fully on the phone, with Tesseract OCR.
// JS: requireNativeModule('LabelOcr').recognize(uri) → text (lines separated by \n).
class LabelOcrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready yet", null)

  override fun definition() = ModuleDefinition {
    Name("LabelOcr")

    // Runs on a background thread (AsyncFunction), so the UI stays responsive while reading.
    AsyncFunction("recognize") { uri: String ->
      val dataDir = ensureModel(context)
      val bitmap = loadBitmap(context, Uri.parse(uri))
      val api = TessBaseAPI()
      try {
        if (!api.init(dataDir.absolutePath, "eng")) {
          throw CodedException("ERR_OCR_INIT", "Could not start the text reader", null)
        }
        api.pageSegMode = TessBaseAPI.PageSegMode.PSM_AUTO
        api.setImage(bitmap)
        api.getUTF8Text() ?: ""
      } finally {
        api.recycle()
        bitmap.recycle()
      }
    }
  }

  // Tesseract reads models from <dir>/tessdata/; copy the bundled one there once (and again after updates).
  private fun ensureModel(ctx: Context): File {
    val base = File(ctx.filesDir, "tesseract")
    val target = File(base, "tessdata/eng.traineddata")
    val size = ctx.assets.openFd("tessdata/eng.traineddata").use { it.length }
    if (!target.exists() || target.length() != size) {
      target.parentFile?.mkdirs()
      val tmp = File(target.parentFile, "eng.traineddata.tmp")
      ctx.assets.open("tessdata/eng.traineddata").use { input -> tmp.outputStream().use { input.copyTo(it) } }
      tmp.renameTo(target)
    }
    return base
  }

  // Decode at a sensible size (labels need ~1500-2500 px on the long side), upright, in grayscale.
  private fun loadBitmap(ctx: Context, uri: Uri): Bitmap {
    val resolver = ctx.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      throw CodedException("ERR_IMAGE", "Could not open the photo", null)
    }
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 2000) sample *= 2
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    val raw = resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, opts) }
      ?: throw CodedException("ERR_IMAGE", "Could not read the photo", null)

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

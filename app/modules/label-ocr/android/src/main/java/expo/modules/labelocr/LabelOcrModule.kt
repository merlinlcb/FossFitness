package expo.modules.labelocr

import android.content.Context
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// JS: requireNativeModule('LabelOcr').recognize(uri) → text (lines separated by \n).
//     requireNativeModule('LabelOcr').selfTest()     → text read from a label image bundled with the app.
// The work happens in LabelReader; AsyncFunctions run on a background thread, so the UI stays responsive.
class LabelOcrModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready yet", null)

  override fun definition() = ModuleDefinition {
    Name("LabelOcr")

    AsyncFunction("recognize") { uri: String ->
      guard { LabelReader.readUri(context, Uri.parse(uri)) }
    }

    AsyncFunction("selfTest") {
      guard { LabelReader.readSample(context) }
    }
  }

  private fun <T> guard(block: () -> T): T = try {
    block()
  } catch (e: LabelReaderException) {
    throw CodedException(e.code, e.message ?: "Label reading failed", e)
  }
}

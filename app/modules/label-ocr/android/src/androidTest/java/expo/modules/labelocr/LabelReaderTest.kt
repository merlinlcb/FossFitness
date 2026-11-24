package expo.modules.labelocr

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

// Runs on a real Android system (CI emulator). Guards the scan path that broke in 2.1.0.
@RunWith(AndroidJUnit4::class)
class LabelReaderTest {
  private val ctx get() = InstrumentationRegistry.getInstrumentation().targetContext

  @Test
  fun readsTheSampleLabel() {
    File(ctx.filesDir, "tesseract").deleteRecursively() // first run after install
    val text = LabelReader.readSample(ctx)
    for (word in listOf("Nutrition", "Calories", "250", "Protein", "Sodium")) {
      assertTrue("expected \"$word\" in:\n$text", text.contains(word))
    }
  }

  @Test
  fun readsAgainWithTheModelAlreadyInstalled() {
    LabelReader.readSample(ctx)
    val text = LabelReader.readSample(ctx)
    assertTrue(text, text.contains("Calories"))
  }

  @Test
  fun repairsABrokenModelCopy() {
    val model = File(LabelReader.ensureModel(ctx), LabelReader.MODEL_ASSET)
    model.writeText("")
    File(model.parentFile, "eng.version").writeText("old")
    val text = LabelReader.readSample(ctx)
    assertTrue(text, text.contains("Calories"))
    assertTrue(model.length() > 1_000_000)
  }
}

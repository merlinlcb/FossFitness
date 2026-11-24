package expo.modules.apphandoff

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

// Used by the old "Health Tracker" app to move a person to FossFitness on the same phone:
//   peer(pkg)        → { installed, versionCode, certs: [sha256 hex of each signing certificate] }
//   open(pkg, url)   → opens `url` in that app only (an explicit intent; no other app can receive it)
//   openAppDetails() → this app's Android settings page (where Uninstall is)
class AppHandoffModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready yet", null)

  override fun definition() = ModuleDefinition {
    Name("AppHandoff")

    Function("peer") { pkg: String ->
      val pm = context.packageManager
      try {
        val info = if (Build.VERSION.SDK_INT >= 28) {
          pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES)
        } else {
          @Suppress("DEPRECATION")
          pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES)
        }
        val sigs = if (Build.VERSION.SDK_INT >= 28) {
          val s = info.signingInfo
          when {
            s == null -> emptyArray()
            s.hasMultipleSigners() -> s.apkContentsSigners
            else -> s.signingCertificateHistory
          }
        } else {
          @Suppress("DEPRECATION")
          info.signatures ?: emptyArray()
        }
        val certs = sigs.map { sig ->
          MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).joinToString("") { "%02x".format(it) }
        }
        val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
        mapOf("installed" to true, "versionCode" to code, "certs" to certs)
      } catch (e: PackageManager.NameNotFoundException) {
        mapOf("installed" to false, "versionCode" to 0L, "certs" to emptyList<String>())
      }
    }

    Function("open") { pkg: String, url: String ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .setPackage(pkg)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }

    Function("openAppDetails") {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }
}

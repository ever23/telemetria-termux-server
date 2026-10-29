package com.termux.telemetry.launcher

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var layoutOffline: LinearLayout
    private lateinit var cardAppsButton: MaterialCardView
    private lateinit var btnRetry: MaterialButton
    private lateinit var btnLaunchTermux: MaterialButton

    private val targetUrl = "http://127.0.0.1:3055/?launcher=1"
    private var isOffline = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        layoutOffline = findViewById(R.id.layoutOffline)
        cardAppsButton = findViewById(R.id.cardAppsButton)
        btnRetry = findViewById(R.id.btnRetry)
        btnLaunchTermux = findViewById(R.id.btnLaunchTermux)

        setupWebView()

        swipeRefresh.setColorSchemeColors(0xFF00E676.toInt())
        swipeRefresh.setProgressBackgroundColorSchemeColor(0xFF09120E.toInt())
        swipeRefresh.setOnRefreshListener {
            loadDashboard()
        }

        cardAppsButton.setOnClickListener {
            openAppsDrawer()
        }

        btnRetry.setOnClickListener {
            loadDashboard()
        }

        btnLaunchTermux.setOnClickListener {
            val termuxIntent = packageManager.getLaunchIntentForPackage("com.termux")
            if (termuxIntent != null) {
                startActivity(termuxIntent)
            } else {
                openAppsDrawer()
            }
        }

        loadDashboard()
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = false

        webView.setBackgroundColor(0xFF060A08.toInt())

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                swipeRefresh.isRefreshing = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                if (!isOffline) {
                    showOnline()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    isOffline = true
                    swipeRefresh.isRefreshing = false
                    showOffline()
                }
            }
        }
    }

    private fun loadDashboard() {
        isOffline = false
        layoutOffline.visibility = View.GONE
        webView.visibility = View.VISIBLE
        webView.loadUrl(targetUrl)
    }

    private fun showOffline() {
        webView.visibility = View.GONE
        layoutOffline.visibility = View.VISIBLE
    }

    private fun showOnline() {
        layoutOffline.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun openAppsDrawer() {
        val drawer = AppsBottomSheet()
        drawer.show(supportFragmentManager, "AppsBottomSheet")
    }

    // Gestion de reposo y bateria para Moto E20 (2GB RAM)
    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers() // Congela bucles JavaScript y polling de red al apagarse la pantalla
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    // Al actuar como HOME Launcher, el boton atras no debe cerrar la actividad principal
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // En un Launcher, atras no hace nada (te mantiene en la pantalla principal)
    }
}

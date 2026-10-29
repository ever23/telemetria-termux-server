package com.termux.telemetry.launcher

import android.graphics.drawable.Drawable

data class AppModel(
    val label: String,
    val packageName: String,
    val icon: Drawable
)

package com.termux.telemetry.launcher

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class AppsBottomSheet : BottomSheetDialogFragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_apps_drawer, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val recycler = view.findViewById<RecyclerView>(R.id.recyclerApps)
        val btnSettings = view.findViewById<ImageButton>(R.id.btnSettingsShortcut)

        recycler.layoutManager = GridLayoutManager(requireContext(), 4)

        // Boton directo a los Ajustes de Android
        btnSettings.setOnClickListener {
            startActivity(Intent(Settings.ACTION_SETTINGS))
            dismiss()
        }

        // Cargar lista de aplicaciones de forma asincrona / directa
        val pm = requireContext().packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val resolved = pm.queryIntentActivities(mainIntent, 0)
        val myPackage = requireContext().packageName

        val list = resolved
            .filter { it.activityInfo.packageName != myPackage }
            .map {
                AppModel(
                    label = it.loadLabel(pm).toString(),
                    packageName = it.activityInfo.packageName,
                    icon = it.loadIcon(pm)
                )
            }
            .sortedBy { it.label.lowercase() }

        recycler.adapter = AppsAdapter(list) { selectedApp ->
            val launchIntent = pm.getLaunchIntentForPackage(selectedApp.packageName)
            if (launchIntent != null) {
                startActivity(launchIntent)
            }
            dismiss()
        }
    }
}

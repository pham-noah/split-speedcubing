package org.example.split;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // declared before super.onCreate: the bridge registers every plugin during super, and one registered
        // afterwards is not in the list it hands the web view
        registerPlugin(ApkInstallerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

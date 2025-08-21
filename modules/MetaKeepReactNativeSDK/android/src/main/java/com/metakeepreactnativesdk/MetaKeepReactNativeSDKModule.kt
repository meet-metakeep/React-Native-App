package com.metakeepreactnativesdk

import com.facebook.react.bridge.JSONArguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.bridge.LifecycleEventListener
import org.json.JSONObject
import xyz.metakeep.sdk.*

class MetaKeepReactNativeSDKModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    private var sdk: MetaKeep? = null
    private var pendingAppId: String? = null

    private val lifecycleListener = object : LifecycleEventListener {
        override fun onHostResume() {
            if (sdk == null) {
                val appIdToInit = pendingAppId
                val activity: android.app.Activity? = reactApplicationContext.currentActivity
                if (appIdToInit != null && activity != null) {
                    sdk = MetaKeep(appIdToInit, AppContext(activity))
                    pendingAppId = null
                    reactApplicationContext.removeLifecycleEventListener(this)
                }
            } else {
                reactApplicationContext.removeLifecycleEventListener(this)
            }
        }

        override fun onHostPause() {}
        override fun onHostDestroy() {}
    }

    override fun getName(): String {
        return NAME
    }

    @ReactMethod
    fun initialize(appId: String) {
        val activity: android.app.Activity? = reactApplicationContext.currentActivity
        if (activity != null) {
            sdk = MetaKeep(appId, AppContext(activity))
            pendingAppId = null
        } else {
            // Defer initialization until an Activity is available
            pendingAppId = appId
            reactApplicationContext.addLifecycleEventListener(lifecycleListener)
        }
    }

    @ReactMethod
    fun setUser(
        user: ReadableMap,
        promise: Promise,
    ) {
        val instance = ensureInitialized(promise) ?: return
        // Only email is supported for now
        user.getString(EMAIL_FIELD)?.let {
            instance.user = User(email = it)
            promise.resolve(null)
        } ?: run {
            rejectWithErrorStatus(INVALID_USER_ERROR_STATUS, promise)
        }
    }

    @ReactMethod
    fun signMessage(
        message: String,
        reason: String,
        promise: Promise,
    ) {
        val instance = ensureInitialized(promise) ?: return
        instance.signMessage(message, reason, getCallback(promise))
    }

    @ReactMethod
    fun signTransaction(
        transaction: ReadableMap,
        reason: String,
        promise: Promise,
    ) {
        val instance = ensureInitialized(promise) ?: return
        instance.signTransaction(readableMapToJsonRequest(transaction), reason, getCallback(promise))
    }

    @ReactMethod
    fun signTypedData(
        typedData: ReadableMap,
        reason: String,
        promise: Promise,
    ) {
        val instance = ensureInitialized(promise) ?: return
        instance.signTypedData(readableMapToJsonRequest(typedData), reason, getCallback(promise))
    }

    @ReactMethod
    fun getConsent(
        consentToken: String,
        promise: Promise,
    ) {
        val instance = ensureInitialized(promise) ?: return
        instance.getConsent(consentToken, getCallback(promise))
    }

    @ReactMethod
    fun getWallet(promise: Promise) {
        val instance = ensureInitialized(promise) ?: return
        instance.getWallet(getCallback(promise))
    }

    private fun getCallback(promise: Promise): Callback {
        return Callback(
            onSuccess = { response: JsonResponse ->
                promise.resolve(jsonResponseToWriteableMap(response))
            },
            // Pack the actual JSON error response into the userInfo map.
            // This will be extracted in the JS layer and returned as the error.
            onFailure = { error: JsonResponse ->
                promise.reject(OPERATION_FAILED_ERROR_STATUS, jsonResponseToWriteableMap(error))
            },
        )
    }

    private fun jsonResponseToWriteableMap(response: JsonResponse): WritableMap {
        // We convert the response to a JSON string and then parse it back to a WritableMap
        // so we can pass it to the JS layer.
        val writableMap = WritableNativeMap()
        writableMap.merge(JSONArguments.fromJSONObject(JSONObject(response.data.toString())))
        return writableMap
    }

    private fun readableMapToJsonRequest(map: ReadableMap): JsonRequest {
        // We convert the ReadableMap to a JSON string and then parse it back to a JsonRequest
        return JsonRequest(JSONObject(map.toHashMap()).toString())
    }

    private fun rejectWithErrorStatus(
        status: String,
        promise: Promise,
    ) {
        val userInfo = WritableNativeMap()
        userInfo.putString(STATUS_FIELD, status)
        promise.reject(status, userInfo)
    }

    private fun ensureInitialized(promise: Promise): MetaKeep? {
        val instance = sdk
        if (instance == null) {
            rejectWithErrorStatus(NOT_INITIALIZED_ERROR_STATUS, promise)
            return null
        }
        return instance
    }

    companion object {
        const val NAME = "MetaKeepReactNativeSDK"

        // Error status
        const val INVALID_USER_ERROR_STATUS = "INVALID_USER"
        const val OPERATION_FAILED_ERROR_STATUS = "OPERATION_FAILED"
        const val NOT_INITIALIZED_ERROR_STATUS = "NOT_INITIALIZED"

        // Constant strings
        const val EMAIL_FIELD = "email"
        const val STATUS_FIELD = "status"
    }
}

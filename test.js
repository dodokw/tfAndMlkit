import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Modal, TextInput, Alert } from 'react-native'
import { useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera'
import { Camera, FaceDetectionOptions } from 'react-native-vision-camera-face-detector'
import { runOnJS } from 'react-native-reanimated'
import { loadTensorflowModel } from 'react-native-fast-tflite'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width, height } = Dimensions.get('window')

const FaceRecognition = () => {
  const { hasPermission, requestPermission } = useCameraPermission()
  const camera = useRef(null)
  const device = useCameraDevice('front')

  const [faceData, setFaceData] = useState(null)
  const [recognizedPerson, setRecognizedPerson] = useState('Unknown')
  const [isProcessingFrame, setIsProcessingFrame] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [capturedFace, setCapturedFace] = useState(null)
  const [savedFaces, setSavedFaces] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [model, setModel] = useState(null)

  // Face detection options
  const faceDetectionOptions = useRef<FaceDetectionOptions>({
    // detection options
  }).current

  // Load TensorFlow model and saved faces on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load TensorFlow model
        const loadedModel = await loadTensorflowModel(require('./assets/model/facenet.tflite'))
        setModel(loadedModel)
        console.log('TensorFlow model loaded successfully')

        // Load saved faces from AsyncStorage
        const loadedFaces = await loadSavedFaces()
        if (loadedFaces) {
          setSavedFaces(loadedFaces)
          console.log(`Loaded ${loadedFaces.length} faces from storage`)
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
        Alert.alert('Initialization Error', 'Failed to load face recognition model.')
      }
    }

    initialize()

    return () => {
      // Cleanup
      if (model) {
        // Close model if needed
        console.log('Cleaning up resources')
      }
    }
  }, [])

  // Check and request camera permission
  useEffect(() => {
    if (!hasPermission) {
      requestPermission()
    }
  }, [hasPermission, requestPermission])

  // Load saved faces from AsyncStorage
  const loadSavedFaces = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('savedFaces')
      return jsonValue != null ? JSON.parse(jsonValue) : []
    } catch (error) {
      console.error('Error loading saved faces:', error)
      return []
    }
  }

  // Save faces to AsyncStorage
  const saveFacesToStorage = async (faces) => {
    try {
      const jsonValue = JSON.stringify(faces)
      await AsyncStorage.setItem('savedFaces', jsonValue)
    } catch (error) {
      console.error('Error saving faces:', error)
      Alert.alert('Storage Error', 'Failed to save face data.')
    }
  }

  // Helper function to extract face embeddings using TensorFlow model
  const extractFaceEmbedding = async (faceImage) => {
    console.log('work????:::???')
    if (!model) return null

    try {
      // Process image with TensorFlow model to get face embeddings using runForMultipleInputsOutputs
      // Similar to how it's used in the Java source
      const inputs = {
        input_1: faceImage,
      }

      const outputs = {
        output_1: { dtype: 'float32', shape: [1, 192] }, // Assuming output shape, adjust as needed
      }

      // const result = await model.runForMultipleInputsOutputs([inputs], [outputs])
      // return result[0] // Adjust based on actual output structure
      console.log('process face embedding.......')
      const result = await model.run([inputs])
      console.log('result', result)
    } catch (error) {
      console.error('Error extracting face embedding:', error)
      return null
    }
  }

  // Calculate similarity between face embeddings (cosine similarity)
  const calculateSimilarity = (embedding1, embedding2) => {
    // Cosine similarity implementation
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  // Find the closest match for a face embedding
  const findMatch = (embedding) => {
    if (savedFaces.length === 0) return null

    let maxSimilarity = -1
    let bestMatch = null

    for (const face of savedFaces) {
      const similarity = calculateSimilarity(embedding, face.embedding)
      if (similarity > maxSimilarity && similarity > 0.8) {
        // Threshold for similarity
        maxSimilarity = similarity
        bestMatch = face
      }
    }

    return bestMatch
  }

  // Prepare image for model input
  const prepareImageForModel = (imageData, faceBounds) => {
    // This is a placeholder for the actual implementation
    // In reality, this would crop the face from the frame, resize to the expected input size,
    // normalize pixel values, etc. based on what the model expects

    // Example preprocessing (pseudocode):
    // 1. Crop the face region using faceBounds
    // 2. Resize to model input size (e.g., 112x112)
    // 3. Convert to float32 and normalize pixel values

    return {
      // Preprocessed image data
      width: 112, // Example expected model input size
      height: 112,
      data: new Float32Array(112 * 112 * 3), // Placeholder for actual pixel data
      // Additional metadata needed by the model
    }
  }

  // Process detected faces
  const processDetectedFace = async (face, imageData) => {
    console.log('processDetectedFace222222222222')
    if (!isProcessingFrame && model) {
      setIsProcessingFrame(true)

      try {
        // Extract face region from the frame and prepare for model input
        const preparedFaceImage = prepareImageForModel(imageData, face.bounds)

        // Get face embedding
        const embedding = await extractFaceEmbedding(preparedFaceImage)
        return
        if (embedding) {
          // Try to recognize the face
          const match = findMatch(embedding)

          if (match) {
            setRecognizedPerson(match.name)
          } else {
            setRecognizedPerson('Unknown')
          }
        }
      } catch (error) {
        console.error('Error processing face:', error)
      }

      setIsProcessingFrame(false)
    }
  }

  // Handle face detection callback
  const handleFacesDetection = (faces, frame) => {
    // console.log('face', faces[0])
    // if (faces && faces.length > 0) {
    if (faces[0]) {
      // Get the largest face (assume it's the main subject)
      // console.log('facedetected')

      // console.log('faces', faces)
      // console.log(typeof faces)
      // const faceArray = Object.values(faces)
      // console.log('faceArray:::::', faceArray)

      // console.log('faces:', faces)
      // console.log('typeof faces:', typeof faces)

      // for (const key in faces) {
      //   console.log('key:', key, 'value:', faces[key])
      // }

      // console.log('Object.keys:', Object.keys(faces))
      // console.log('Object.getOwnPropertyNames:', Object.getOwnPropertyNames(faces))
      // console.log('Object.values:', Object.values(faces))

      // const descriptor = Object.getOwnPropertyDescriptor(faces, '0')
      // console.log('Property descriptor for "0":', descriptor)
      // console.log('Is faces a Proxy?', faces instanceof Proxy)
      const pureFaces = JSON.parse(JSON.stringify(faces))
      // console.log('pureFaces:', pureFaces)
      // console.log('Object.values(pureFaces):', Object.values(pureFaces))
      const newFaces = Object.values(pureFaces)

      const largestFace = newFaces.reduce((prev, current) => {
        const prevArea = prev.bounds.width * prev.bounds.height
        const currentArea = current.bounds.width * current.bounds.height
        return prevArea > currentArea ? prev : current
      })
      // console.log('setFaceData....:::', largestFace)
      setFaceData(largestFace)

      // If we're in recording mode, process the face
      if (isRecording) {
        console.log('processDetectedFace')
        processDetectedFace(largestFace, frame)
      }
    } else {
      setFaceData(null)
      if (isRecording) {
        setRecognizedPerson('No face detected')
      }
    }
  }

  // Capture face for enrolling a new person
  const captureFace = async () => {
    if (!camera.current || !faceData) {
      Alert.alert('Capture Error', 'No face detected or camera not ready.')
      return
    }

    try {
      // Take a photo
      console.log('takephoto!!!')
      const photo = await camera.current.takePhoto({
        flash: 'off',
        quality: 90,
      })

      // Process the photo to extract just the face region
      setCapturedFace({
        path: photo.path,
        bounds: faceData.bounds,
      })

      // Show modal to enter person's name
      setModalVisible(true)
    } catch (error) {
      console.error('Error capturing face:', error)
      Alert.alert('Capture Error', 'Failed to capture face. Please try again.')
    }
  }

  // Prepare captured face for model
  const prepareCapturedFace = async (facePath, faceBounds) => {
    // This is a placeholder for the actual implementation
    // In reality, this would load the image from disk, crop the face,
    // resize, normalize, etc.

    return {
      // Preprocessed image data
      width: 112, // Example expected model input size
      height: 112,
      data: new Float32Array(112 * 112 * 3), // Placeholder for actual pixel data
    }
  }

  // Add new person with captured face
  const addNewPerson = async () => {
    if (!capturedFace || !newPersonName.trim() || !model) {
      Alert.alert('Input Error', 'Please provide a name and ensure a face is captured.')
      return
    }

    try {
      // Prepare the captured face for the model
      const preparedFace = await prepareCapturedFace(capturedFace.path, capturedFace.bounds)

      // Extract face embedding
      const embedding = await extractFaceEmbedding(preparedFace)

      if (embedding) {
        // Create new person entry
        const newPerson = {
          id: Date.now().toString(),
          name: newPersonName.trim(),
          embedding: embedding,
          imagePath: capturedFace.path,
        }

        // Add to saved faces
        const updatedFaces = [...savedFaces, newPerson]
        setSavedFaces(updatedFaces)

        // Save to storage
        await saveFacesToStorage(updatedFaces)

        // Reset state
        setNewPersonName('')
        setCapturedFace(null)
        setModalVisible(false)

        Alert.alert('Success', `Added ${newPersonName} successfully!`)
      } else {
        Alert.alert('Processing Error', 'Could not process face features. Please try again.')
      }
    } catch (error) {
      console.error('Error adding new person:', error)
      Alert.alert('Error', 'Failed to add new person. Please try again.')
    }
  }

  // Toggle face recognition mode
  const toggleRecognition = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      setRecognizedPerson('Scanning...')
    } else {
      setRecognizedPerson('Recognition stopped')
    }
  }

  // Render face overlay box
  const renderFaceBox = () => {
    if (!faceData) return null

    const { bounds } = faceData
    const boxStyle = {
      position: 'absolute',
      borderWidth: 2,
      borderColor: isRecording ? '#00FF00' : '#FFFFFF',
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
    }

    return <View style={boxStyle} />
  }

  // Clear all saved faces
  const clearAllFaces = async () => {
    Alert.alert('Clear All Faces', 'Are you sure you want to delete all saved faces?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('savedFaces')
            setSavedFaces([])
            Alert.alert('Success', 'All faces have been deleted.')
          } catch (error) {
            console.error('Error clearing faces:', error)
            Alert.alert('Error', 'Failed to clear saved faces.')
          }
        },
      },
    ])
  }

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={styles.camera}
        isActive={true}
        device={device}
        faceDetectionCallback={handleFacesDetection}
        faceDetectionOptions={faceDetectionOptions}
        photo={true}
      />

      {/* Face overlay */}
      <View style={styles.overlay}>
        {renderFaceBox()}

        {/* Recognition status */}
        <View style={styles.recognitionStatus}>
          <Text style={styles.recognitionText}>{isRecording ? `Recognized: ${recognizedPerson}` : 'Recognition Inactive'}</Text>
        </View>

        {/* Control buttons */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.button, isRecording ? styles.activeButton : null]} onPress={toggleRecognition}>
            <Text style={styles.buttonText}>{isRecording ? 'Stop Recognition' : 'Start Recognition'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isRecording ? styles.disabledButton : null]}
            onPress={captureFace}
            disabled={isRecording || !faceData}>
            <Text style={styles.buttonText}>Add Face</Text>
          </TouchableOpacity>
        </View>

        {/* Saved faces count and clear button */}
        <View style={styles.savedFacesContainer}>
          <View style={styles.savedFacesInfo}>
            <Text style={styles.text}>Saved Faces: {savedFaces.length}</Text>
          </View>

          {savedFaces.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearAllFaces}>
              <Text style={styles.buttonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Add Person Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Person</Text>

            <TextInput style={styles.input} placeholder="Enter Person's Name" value={newPersonName} onChangeText={setNewPersonName} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false)
                  setCapturedFace(null)
                  setNewPersonName('')
                }}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={addNewPerson}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'red',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  recognitionStatus: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    margin: 20,
    borderRadius: 10,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recognitionText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  },
  button: {
    backgroundColor: '#4a90e2',
    padding: 15,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#e74c3c',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  savedFacesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 8,
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  savedFacesInfo: {
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 5,
    marginLeft: 10,
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  saveButton: {
    backgroundColor: '#2ecc71',
  },
})

export function App(): JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <FaceRecognition />
    </View>
  )
}

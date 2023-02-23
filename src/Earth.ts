/* Assignment 3: Earthquake Visualization
 * CSCI 4611, Fall 2022, University of Minnesota
 * Instructor: Evan Suma Rosenberg <suma@umn.edu>
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import * as gfx from 'gophergfx'
import { Quaternion, Vector3 } from 'gophergfx';
import { EarthquakeMarker } from './EarthquakeMarker';
import { EarthquakeRecord } from './EarthquakeRecord';

export class Earth extends gfx.Transform3
{
    private meshResolution: number;     
    private earthMesh: gfx.Mesh;
    public earthMaterial: gfx.MorphMaterial;

    public globeMode: boolean;
    public naturalRotation: gfx.Quaternion;
    public mouseRotation: gfx.Quaternion;

    constructor()
    {
        // Call the superclass constructor
        super();

        // 20x20 is reasonable for a good looking sphere
        // 150x150 is better for height mapping
        this.meshResolution = 150;
        this.earthMesh = new gfx.Mesh();
        this.earthMaterial = new gfx.MorphMaterial();

        this.globeMode = false;
        this.naturalRotation = new gfx.Quaternion();
        this.mouseRotation = new gfx.Quaternion();
    }

    public createMesh() : void
    {

        // Initialize texture: you can change to a lower-res texture here if needed
        // Note that this won't display properly until you assign texture coordinates to the mesh
        this.earthMaterial.texture = new gfx.Texture('./assets/earth-2k.png');
        
        // This disables mipmapping, which makes the texture appear sharper
        this.earthMaterial.texture.setMinFilter(true, false);

        // A rotation about the Z axis is the earth's axial tilt
        this.naturalRotation.setRotationZ(-23.4 * Math.PI / 180); 

        // Precalculated vertices, normals, and triangle indices.
        // After we compute them, we can store them directly in the earthMesh,
        // so they don't need to be member variables.
        const mapVertices: number[] = [];
        const mapNormals: number[] = [];
        const indices: number[] = [];
        const texCoords: number[] = [];
        
        // As a demo, we'll add a square with 2 triangles.
        // First, we define vertices
        for(let row=0; row<=this.meshResolution; row++){
            for(let col=0; col<=this.meshResolution; col++){
                // vertices
                const lat = -180 + (row/this.meshResolution) * 360;
                const long = -90 + (col/this.meshResolution) * 180; 
                const flatCoordinates = this.convertLatLongToPlane(lat, long);

                mapVertices.push(flatCoordinates.y, flatCoordinates.x, 0);
                
                // The normals are always directly outward towards the camera
                mapNormals.push(0, 0, 1);

                // Add textures woooo!
                texCoords.push((row/this.meshResolution) - 1, 1 - (col/this.meshResolution));
            }   
        }

        // Next we define indices into the array for the triangles
        for(let row=0; row<this.meshResolution; row++){
            for(let col=0; col<this.meshResolution; col++){
                const ul = (this.meshResolution + 1) * row + col; // (0,0)
                const ur = (this.meshResolution + 1) * row + (col + 1); // (0,1)
                const ll = (this.meshResolution + 1) * (row + 1) + col; // (1, 0)
                const lr = (this.meshResolution + 1) * (row + 1) + (col + 1); // (1, 1)

                indices.push(ul, lr, ur);
                indices.push(ul, ll, lr);
            }
        }

        // Set all the earth mesh data
        this.earthMesh.setVertices(mapVertices, true);
        this.earthMesh.setNormals(mapNormals, true);
        this.earthMesh.setIndices(indices);
        this.earthMesh.setTextureCoordinates(texCoords, true);
        this.earthMesh.createDefaultVertexColors();
        this.earthMesh.material = this.earthMaterial;

        // compute morph mesh data
        this.computeMorphTarget(this.earthMesh);

        // Add the mesh to this group
        this.add(this.earthMesh);
    }

    private computeMorphTarget(mesh: gfx.Mesh): void {
        // copy flat vertices and normals
        const v = mesh.getVertices();
        const n = mesh.getNormals();

        const flatVertices: Vector3[] = [];
        const flatNormals: Vector3[] = [];

        for(let i=0; i<v.length; i+=3){
            flatVertices.push(new gfx.Vector3(v[i], v[i+1], v[i+2]));
            flatNormals.push(new gfx.Vector3(n[i], n[i+1], n[i+2]));
        }

        // sphere coordinates
        const sphereVertices: Vector3[] = [];
        const sphereNormals: Vector3[] = [];

        for(let row=0; row<=this.meshResolution; row++){
            for(let col=0; col<=this.meshResolution; col++){
                // vertices
                const lat = -180 + (row/this.meshResolution) * 360;
                const long = -90 + (col/this.meshResolution) * 180; 
                const sphereCoordinates = this.convertLatLongToSphere(lat, long);

                sphereVertices.push(new gfx.Vector3(sphereCoordinates.x, sphereCoordinates.y, sphereCoordinates.z));

                // globe mesh normals
                // n = vector poitning form the origin to the vertex position
                const sNormal = new gfx.Vector3();
                const origin = new gfx.Vector3();

                sNormal.copy(sphereCoordinates);
                origin.set(0, 0, 0);
                sNormal.subtract(origin);
                sNormal.normalize();  

                sphereNormals.push(new gfx.Vector3(sNormal.x, sNormal.y, sNormal.z));
            }
        }
        mesh.setMorphTargetVertices(sphereVertices);
        mesh.setMorphTargetNormals(sphereNormals);
    }

    // add animations for mesh morphing
    public update(deltaTime: number) : void
    {
        const morphSpeed = 0.5;
        this.earthMaterial.morphAlpha = gfx.MathUtils.clamp(this.earthMaterial.morphAlpha, 0, 1);
     
        if(this.globeMode){
            this.rotateY(morphSpeed * deltaTime);
            this.rotation.slerp(Quaternion.IDENTITY, this.rotation , this.earthMaterial.morphAlpha);
            this.earthMaterial.morphAlpha += morphSpeed * deltaTime;
        }
        
        else if (!this.globeMode){
            this.rotation.slerp(Quaternion.IDENTITY, this.rotation, this.earthMaterial.morphAlpha);
            this.earthMaterial.morphAlpha -= morphSpeed * deltaTime;
        }
    }

    public createEarthquake(record: EarthquakeRecord, normalizedMagnitude : number)
    {
        // Number of milliseconds in 1 year (approx.)
        const duration = 12 * 28 * 24 * 60 * 60;

        const flatCoordinates = this.convertLatLongToPlane(record.latitude, record.longitude);
        const lat = flatCoordinates.y;
        const lon = flatCoordinates.x;
        const sphereCoordinates = new gfx.Vector3(Math.cos(lat) * Math.sin(lon),
                                    Math.sin(lat),
                                    Math.cos(lat) * Math.cos(lon));

        const mapPosition = new gfx.Vector3(flatCoordinates.x, flatCoordinates.y, flatCoordinates.z);
        const globePosition = new gfx.Vector3(sphereCoordinates.x, sphereCoordinates.y, sphereCoordinates.z);
        const earthquake = new EarthquakeMarker(mapPosition, globePosition, record, duration);

        earthquake.material.setColor(new gfx.Color(1, 1 - normalizedMagnitude, 0));
        
        this.add(earthquake);
    }

    public animateEarthquakes(currentTime : number)
    {
        // This code removes earthquake markers after their life has expired
        this.children.forEach((quake: gfx.Transform3) => {
            if(quake instanceof EarthquakeMarker)
            {
                const playbackLife = (quake as EarthquakeMarker).getPlaybackLife(currentTime);
                this.earthMaterial.morphAlpha = gfx.MathUtils.clamp(this.earthMaterial.morphAlpha, 0, 1);
                quake.position.lerp(quake.mapPosition, quake.globePosition, this.earthMaterial.morphAlpha);
                
                if(playbackLife >= 1)
                {
                    quake.remove();
                }
                else
                {
                    // Global adjustment to reduce the size. 
                    quake.scale.set(quake.magnitude, quake.magnitude, quake.magnitude);
                }
            }
        });
    }

    public convertLatLongToSphere(latitude: number, longitude: number) : gfx.Vector3
    {
        // round, needs to be in radians -- convert degrees to radians, calculate polar coordinates using these
        const radianForm = this.convertLatLongToPlane(latitude, longitude);

        return new gfx.Vector3(Math.cos(radianForm.x) * Math.sin(radianForm.y),
                                Math.sin(radianForm.x),
                                Math.cos(radianForm.x) * Math.cos(radianForm.y));
    }

    public convertLatLongToPlane(latitude: number, longitude: number) : gfx.Vector3
    {
        // flat, degrees to radians
        return new gfx.Vector3(longitude * (Math.PI/180), latitude * (Math.PI/180), 0);
    }

    // This function toggles the wireframe debug mode on and off
    public toggleDebugMode(debugMode : boolean)
    {
        this.earthMaterial.wireframe = debugMode;
    }
}
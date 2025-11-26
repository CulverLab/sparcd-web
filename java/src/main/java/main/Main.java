package main;

import model.location.Location;
import model.species.Species;
import model.species.SpeciesEntry;
import model.util.UpdateExif;

import java.io.*;
import java.util.*;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Main {

	private static List<SpeciesEntry> parseSpeciesParameter(List<String> strs)
	{
		List<SpeciesEntry> species = new ArrayList<SpeciesEntry>();

		for (String one_str : strs)
		{
			String parts[] = one_str.trim().split(",");
			System.out.println("DEBUG: Species:" + String.join(" - ", parts));
			species.add(new SpeciesEntry(new Species(parts[0], parts[1]), Integer.parseInt(parts[2])));
		}

		return species;
	}

	private static Location parseLocationParameter(String str)
	{
		String parts[] = str.trim().split(",");
		System.out.println("DEBUG: Location:" + String.join(" - ", parts));

		return new Location(parts[0], parts[1], Double.parseDouble(parts[2]), Double.parseDouble(parts[3]), Double.parseDouble(parts[4]));
	}

    public static void main(String[] args) throws JsonProcessingException
    {
    	Boolean argsOk = false;
    	List<SpeciesEntry> species = null;
    	Location loc = null;
    	String imageFile = null;
    	ObjectMapper mapper = new ObjectMapper();

    	// Get the parameters
    	if (args.length > 0)
    	{
    		argsOk = true;
    		for (String one_arg : args)
    		{
    			// Parse the parameters
    			if (one_arg.contains("="))
    			{
    				String params[] = one_arg.split("=", 2);
    				switch (params[0])
    				{
    					case "-file":
    						imageFile = params[1];
    						break;

    					case "-location":
    						String loc_str = mapper.readValue(params[1], String.class);
    						loc = Main.parseLocationParameter(loc_str);
    						break;

    					case "-species":
    						List<String> species_strs = mapper.readValue(params[1], List.class);
    						species = Main.parseSpeciesParameter(species_strs);
    						break;

    					default:
    						System.out.println("Error: found unknown command line parameter " + one_arg);
    						argsOk = false;
    				}
    			}
    			else
    			{
					System.out.println("Error: found mystery command line parameter " + one_arg);
    				argsOk = false;
    			}

    			// Check if we're in error
    			if (argsOk == false)
    				break;
    		}
    	}
    	else
    	{
    		System.out.println("Error: Command line parameters weren't found");
    		System.out.println("  <command> -file=<filename> -location=<location JSON> -species=<species JSON>");
    		System.out.println("\tWhere <command> is the command that runs the .jar file");
    		System.out.println("\tand <filename> is the path of the file to modify");
    		System.out.println("\tand <location JSON> is a string with comma separated values of");
    		System.out.println("\t   name, id, latitude, longitude, elevation");
    		System.out.println("\tand <species JSON> is an JSON string array with each string consisting of ");
    		System.out.println("\tcomma separated values of");
    		System.out.println("\t   common name, scientific name, count");
    	}

    	// If we're not OK, return
    	if (argsOk == false)
    		System.exit(2);
    	if (imageFile == null)
    	{
    		System.out.println("Error: Missing image file name");
    		System.exit(3);
    	}
    	if (loc == null && species == null)
    	{
    		System.out.println("Error: At least one location or one species must be specieid");
    		System.exit(4);
    	}

    	File ifile = new File(imageFile);
	    UpdateExif.
	    	writeToDisk(
	    		ifile, 
	    		species, 
	    		loc);

		System.exit(0);
    }
}
